import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { ExpenseService } from '../modules/ledger/expense.service'
import { BackupService } from '../modules/backup/backup.service'
import { groupLedgerIncome } from '../../shared/ledger-income'

describe('직접 지출 장부', () => {
  let db: DatabaseSync,
    characters: CharacterService,
    repository: LedgerRepository,
    ledger: LedgerService,
    expenses: ExpenseService,
    backup: BackupService,
    characterId: string
  const query = { from: '2026-10-01', to: '2026-10-08' }
  const now = () => new Date('2026-10-08T12:00:00Z')
  beforeEach(() => {
    db = openDatabase(':memory:')
    const chars = new CharacterRepository(db)
    characters = new CharacterService(chars)
    characterId = characters.create({ name: '지출캐릭터', world: '루나' }).id
    repository = new LedgerRepository(db)
    ledger = new LedgerService(repository)
    expenses = new ExpenseService(db, chars, repository, new UnitOfWork(db), now)
    backup = new BackupService(db, () => '/fake/recovery.json', now)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })
  function input(patch = {}) {
    return {
      requestId: randomUUID(),
      characterId,
      date: '2026-10-08',
      category: '강화',
      amount: 123456789,
      notes: '스타포스 비용',
      ...patch
    }
  }
  it('지출과 거래를 한 번 저장하고 조회·대시보드·CSV에 반영한다', () => {
    const request = input(),
      result = expenses.create(request)
    expect(expenses.create(request)).toEqual(result)
    const list = ledger.list(query)
    expect(list.summary).toEqual({ income: 0, expense: 123456789, net: -123456789, count: 1 })
    expect(list.entries[0]).toMatchObject({
      source: 'manual',
      activity: 'expense',
      manualExpenseId: result.id,
      expenseCategory: '강화',
      notes: '스타포스 비용',
      direction: 'expense'
    })
    expect(groupLedgerIncome(list.entries).map((group) => group.amount)).toEqual([0, 0])
    const stats = ledger.dashboard(query)
    expect(stats.sources.find((row) => row.source === 'manual')).toMatchObject({
      expense: 123456789,
      net: -123456789,
      count: 1
    })
    expect(stats.characters[0].net).toBe(-123456789)
    expect(stats.trend.at(-1)?.expense).toBe(123456789)
    expect(ledger.exportCsv(query).content).toContain('"강화","지출","123456789","-123456789"')
    expect(ledger.exportCsv(query).content).toContain('"스타포스 비용"')
    expect(() => expenses.create({ ...request, amount: 5 })).toThrow('같은 저장 요청')
  })
  it('수정은 거래 ID를 유지하며 날짜·캐릭터 필터와 집계를 갱신하고 삭제는 거래도 제거한다', () => {
    const saved = expenses.create(input()),
      entryId = ledger.list(query).entries[0].id
    const other = characters.create({ name: '부캐', world: '리부트' })
    expenses.update({
      ...saved,
      characterId: other.id,
      id: saved.id,
      date: '2026-10-07',
      category: '장비 구매',
      notes: '장비',
      amount: 500
    })
    expect(ledger.list(query).entries[0]).toMatchObject({
      id: entryId,
      date: '2026-10-07',
      characterId: other.id,
      characterWorld: '리부트',
      expenseCategory: '장비 구매',
      amount: 500
    })
    expect(ledger.list({ ...query, characterId }).entries).toEqual([])
    expect(ledger.list({ from: '2026-10-08', to: '2026-10-08' }).entries).toEqual([])
    expect(() => characters.remove(other.id)).toThrow('장부 기록')
    expenses.remove(saved.id)
    expect(ledger.list(query).summary.net).toBe(0)
    expect(db.prepare('SELECT * FROM manual_expenses').all()).toEqual([])
  })
  it('캐릭터 서버가 바뀌어도 같은 캐릭터의 과거 기록 서버를 보존하고 숨긴 기록은 수정 가능하다', () => {
    const saved = expenses.create(input())
    characters.update({ id: characterId, name: '새이름', world: '스카니아', notes: '' })
    characters.setHidden({ id: characterId, isHidden: true })
    expenses.update({ ...saved, amount: 100 })
    expect(ledger.list(query).entries[0]).toMatchObject({
      characterName: '새이름',
      characterWorld: '루나',
      amount: 100
    })
    expect(() => expenses.create(input())).toThrow('숨긴 캐릭터')
    const other = characters.create({ name: '부캐', world: '루나' })
    const otherExpense = expenses.create(input({ characterId: other.id }))
    expect(() => expenses.update({ ...otherExpense, characterId })).toThrow('숨긴 캐릭터')
  })
  it.each([
    { amount: 0 },
    { amount: -1 },
    { amount: 1.5 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { date: '2026-10-09' },
    { date: '2026-02-30' },
    { category: '잘못된 분류' },
    { notes: '가'.repeat(501) },
    { characterId: randomUUID() }
  ])('잘못된 지출을 거부하고 장부를 유지한다: %j', (patch) => {
    expect(() => expenses.create(input(patch))).toThrow()
    expect(ledger.list(query).entries).toEqual([])
  })
  it('거래 저장 실패 시 추가·수정도 함께 되돌린다', () => {
    const saved = expenses.create(input()),
      before = backup.export()
    vi.spyOn(repository, 'syncExpense').mockImplementation(() => {
      throw new Error('저장 실패')
    })
    expect(() => expenses.create(input())).toThrow('저장 실패')
    expect(() => expenses.update({ ...saved, amount: 1 })).toThrow('저장 실패')
    expect(backup.export()).toBe(before)
  })
  it('직접 지출만 수정·삭제하고 자동 거래는 보호한다', () => {
    const saved = expenses.create(input()),
      ledgerId = ledger.list(query).entries[0].id
    expect(() => expenses.remove(ledgerId)).toThrow('지출 기록을 찾을 수 없습니다')
    expect(() => expenses.update({ ...saved, id: randomUUID() })).toThrow(
      '지출 기록을 찾을 수 없습니다'
    )
    expect(ledger.list(query).summary.count).toBe(1)
  })
  it('메모는 CSV 수식 주입을 방지하고 원문 그대로 백업·복원한다', () => {
    const saved = expenses.create(input({ notes: '=SUM(1,2)\n"장비 구매"' }))
    expect(ledger.exportCsv(query).content).toContain('"\'=SUM(1,2)\n""장비 구매"""')
    const content = backup.export(),
      preview = backup.prepare(content, '지출.json')
    expect(preview.incoming.manualExpenses).toBe(1)
    backup.restore({ previewId: preview.id })
    expect(ledger.list(query).entries[0].notes).toBe(saved.notes)
    for (const mutate of [
      (file: {
        tables: {
          manual_expenses: { amount: number; category: string }[]
          ledger_entries: unknown[]
        }
      }) => {
        file.tables.manual_expenses[0].amount += 1
      },
      (file: {
        tables: {
          manual_expenses: { amount: number; category: string }[]
          ledger_entries: unknown[]
        }
      }) => {
        file.tables.ledger_entries = []
      },
      (file: {
        tables: {
          manual_expenses: { amount: number; category: string }[]
          ledger_entries: unknown[]
        }
      }) => {
        file.tables.manual_expenses[0].category = '잘못됨'
      }
    ]) {
      const file = JSON.parse(content)
      mutate(file)
      expect(() => backup.prepare(JSON.stringify(file), '잘못된.json')).toThrow()
      expect(ledger.list(query).summary.count).toBe(1)
    }
  })
  it.each([7, 8, 9])('이전 %i번 백업은 빈 직접 지출로 복원한다', (version) => {
    const file = JSON.parse(backup.export())
    file.schemaVersion = version
    delete file.tables.manual_expenses
    if (version < 9) delete file.tables.crystal_price_history
    for (const row of file.tables.ledger_entries) delete row.manual_expense_id
    const preview = backup.prepare(JSON.stringify(file), '이전.json')
    expect(preview.incoming.manualExpenses).toBe(0)
    backup.restore({ previewId: preview.id })
    expect(ledger.list(query).entries).toEqual([])
  })
})
