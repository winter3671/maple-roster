import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { IncomeService } from '../modules/ledger/income.service'
import { ExpenseService } from '../modules/ledger/expense.service'
import { BackupService } from '../modules/backup/backup.service'
import { groupLedgerIncome } from '../../shared/ledger-income'

describe('직접 수익 기록과 장부 연동', () => {
  let db: DatabaseSync,
    characters: CharacterService,
    incomes: IncomeService,
    ledger: LedgerService,
    expenses: ExpenseService,
    backup: BackupService,
    id: string
  const now = () => new Date('2026-10-15T00:00:00Z')
  const query = { from: '2026-10-01', to: '2026-10-31' }
  const input = (overrides = {}) => ({
    requestId: randomUUID(),
    characterId: id,
    date: '2026-10-15',
    category: '기타',
    amount: 123456789,
    notes: '직접 수익',
    ...overrides
  })
  beforeEach(() => {
    db = openDatabase(':memory:')
    const chars = new CharacterRepository(db),
      repo = new LedgerRepository(db),
      tx = new UnitOfWork(db)
    characters = new CharacterService(chars)
    id = characters.create({ name: '수익캐릭터', world: '레드', notes: '' }).id
    incomes = new IncomeService(db, chars, repo, tx, now)
    expenses = new ExpenseService(db, chars, repo, tx, now)
    ledger = new LedgerService(repo)
    backup = new BackupService(
      db,
      vi.fn(() => '/fake/recovery.json'),
      now
    )
  })
  afterEach(() => db.close())
  it('반복 저장은 중복 수익을 만들지 않고 대시보드·분류별 합계·CSV에 반영한다', () => {
    const request = input({ category: '아이템 판매', notes: '=SUM(1,2)\n"판매"' })
    const saved = incomes.create(request)
    expect(incomes.create(request)).toEqual(saved)
    expect(() => incomes.create({ ...request, amount: 10 })).toThrow('같은 저장 요청')
    expenses.create({ ...input(), category: '기타', amount: 100 })
    const list = ledger.list(query)
    expect(list.summary).toEqual({ income: 123456789, expense: 100, net: 123456689, count: 2 })
    expect(list.entries.find((row) => row.manualIncomeId === saved.id)).toMatchObject({
      source: 'manualIncome',
      activity: 'income',
      incomeCategory: '아이템 판매',
      amount: 123456789
    })
    expect(groupLedgerIncome(list.entries).find((row) => row.activity === 'income')).toEqual({
      activity: 'income',
      amount: 123456789,
      count: 1
    })
    const dashboard = ledger.dashboard(query)
    expect(dashboard.sources.find((row) => row.source === 'manualIncome')).toMatchObject({
      income: 123456789,
      expense: 0,
      net: 123456789
    })
    expect(dashboard.characters[0].net).toBe(123456689)
    const csv = ledger.exportCsv(query).content
    expect(csv).toContain('"아이템 판매","수입"')
    expect(csv).toContain(saved.id)
    expect(csv).toContain("'" + '=SUM(1,2)')
    expect(ledger.list({ ...query, from: '2026-10-16' }).summary.income).toBe(0)
  })
  it('수익 수정은 거래 ID를 유지하고 같은 캐릭터의 기록 당시 서버를 보존한다', () => {
    const saved = incomes.create(input())
    const entryId = ledger.list(query).entries[0].id
    characters.update({ ...characters.list()[0], world: '루나' })
    incomes.update({ ...input(), id: saved.id, amount: 500, notes: '수정' })
    expect(ledger.list(query).entries[0]).toMatchObject({
      id: entryId,
      amount: 500,
      notes: '수정',
      characterWorld: '레드'
    })
    const other = characters.create({ name: '다른캐릭터', world: '스카니아', notes: '' })
    incomes.update({ ...input(), id: saved.id, characterId: other.id })
    expect(ledger.list(query).entries[0]).toMatchObject({
      id: entryId,
      characterId: other.id,
      characterWorld: '스카니아'
    })
    expect(ledger.list({ ...query, characterId: id }).entries).toEqual([])
  })
  it.each([
    { amount: 0 },
    { amount: -1 },
    { amount: 1.5 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { date: '2026-10-16' },
    { category: '잘못된 분류' },
    { notes: '가'.repeat(501) },
    { characterId: randomUUID() }
  ])('잘못된 입력 %j는 저장하지 않는다', (bad) => {
    expect(() => incomes.create(input(bad))).toThrow()
    expect(db.prepare('SELECT * FROM manual_incomes').all()).toEqual([])
    expect(ledger.list(query).entries).toEqual([])
  })
  it('거래 저장 실패는 수익 원본도 롤백하며 재시도할 수 있다', () => {
    db.exec(
      "CREATE TRIGGER reject_income BEFORE INSERT ON ledger_entries WHEN NEW.manual_income_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'test failure'); END"
    )
    const request = input()
    expect(() => incomes.create(request)).toThrow('test failure')
    expect(db.prepare('SELECT * FROM manual_incomes').all()).toEqual([])
    db.exec('DROP TRIGGER reject_income')
    expect(incomes.create(request).amount).toBe(123456789)
  })
  it('삭제 시 연결 거래를 함께 지우고 수익이 있는 캐릭터 삭제를 막는다', () => {
    const saved = incomes.create(input())
    expect(() => characters.remove(id)).toThrow('장부 기록')
    expect(() => incomes.remove(ledger.list(query).entries[0].id)).toThrow('수익 기록')
    incomes.remove(saved.id)
    expect(ledger.list(query).entries).toEqual([])
    characters.remove(id)
    expect(characters.list()).toEqual([])
  })
  it('직접 수익을 백업·복원하고 원본과 거래 금액이 다른 백업은 거부한다', () => {
    const saved = incomes.create(input())
    const file = JSON.parse(backup.export())
    expect(backup.prepare(JSON.stringify(file), '수익.json').incoming.manualIncomes).toBe(1)
    file.tables.ledger_entries[0].amount += 1
    expect(() => backup.prepare(JSON.stringify(file), '잘못된.json')).toThrow('올바르지')
    file.tables.ledger_entries[0].amount -= 1
    incomes.remove(saved.id)
    const preview = backup.prepare(JSON.stringify(file), '수익.json')
    backup.restore({ previewId: preview.id })
    expect(ledger.list(query).entries[0].manualIncomeId).toBe(saved.id)
    expect(ledger.list(query).summary.income).toBe(123456789)
  })
  it('14번 백업은 기존 지출을 보존하고 직접 수익 없이 복원한다', () => {
    expenses.create({ ...input(), category: '기타', amount: 100 })
    const old = JSON.parse(backup.export())
    old.schemaVersion = 14
    delete old.tables.manual_incomes
    for (const row of old.tables.ledger_entries) delete row.manual_income_id
    incomes.create(input())
    backup.restore({ previewId: backup.prepare(JSON.stringify(old), '이전14.json').id })
    expect(ledger.list(query).summary).toEqual({ income: 0, expense: 100, net: -100, count: 1 })
  })
})
