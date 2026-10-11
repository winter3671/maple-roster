import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../database/connection'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { groupLedgerIncome } from '../../shared/ledger-income'
import { seedPerformanceLedger } from './fixtures/ledger-performance'

const query = { from: '2026-10-01', to: '2026-10-31' }
describe('거래 내역 페이지 조회', () => {
  let database: DatabaseSync, repository: LedgerRepository, service: LedgerService, ids: string[]
  beforeEach(() => {
    database = openDatabase(':memory:')
    ids = seedPerformanceLedger(database, 152)
    repository = new LedgerRepository(database)
    service = new LedgerService(repository)
  })
  afterEach(() => database.close())

  it('수익 묶음은 전체를 합산하고 상세 내역만 50건씩 중복·누락 없이 읽는다', () => {
    const full = service.list(query)
    const details = full.entries.filter(
      (entry) => entry.direction === 'expense' || entry.source === 'manualIncome'
    )
    const pages = [1, 2, 3].map((page) => service.page({ ...query, page }))
    expect(pages.map((page) => page.entries.length)).toEqual([50, 50, 1])
    expect(pages.flatMap((page) => page.entries)).toEqual(details)
    for (const page of pages) {
      expect(page.summary).toEqual(full.summary)
      expect(page.incomeGroups).toEqual(groupLedgerIncome(full.entries))
      expect(page.pagination).toMatchObject({ pageSize: 50, total: 101, totalPages: 3 })
    }
    expect(pages[0].pagination.page).toBe(1)
    expect(pages[2].pagination.page).toBe(3)
    expect(service.exportCsv(query).count).toBe(152)
  })
  it('기간·캐릭터 필터를 상세 내역과 모든 합계에 동일하게 적용한다', () => {
    for (const filter of [
      { ...query, characterId: ids[1] },
      { from: '2026-10-08', to: '2026-10-08' },
      { from: '2026-10-08', to: '2026-10-08', characterId: ids[2] }
    ]) {
      const full = service.list(filter),
        page = service.page({ ...filter, page: 1 })
      expect(page.summary).toEqual(full.summary)
      expect(page.incomeGroups).toEqual(groupLedgerIncome(full.entries))
      expect(page.entries).toEqual(
        full.entries.filter((row) => row.direction === 'expense' || row.source === 'manualIncome')
      )
    }
  })
  it('빈 기간과 자동 수입만 있는 캐릭터는 상세 0건·첫 페이지를 반환한다', () => {
    for (const filter of [
      { from: '2026-09-01', to: '2026-09-30' },
      { ...query, characterId: ids[0] }
    ]) {
      const page = service.page({ ...filter, page: 100 })
      expect(page.entries).toEqual([])
      expect(page.pagination).toEqual({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
      expect(page.summary).toEqual(service.list(filter).summary)
    }
  })
  it('범위를 벗어난 요청은 마지막 페이지로 맞추고 잘못된 입력은 거부한다', () => {
    expect(service.page(query).pagination.page).toBe(1)
    expect(service.page({ ...query, page: Number.MAX_SAFE_INTEGER }).pagination.page).toBe(3)
    for (const page of [0, -1, 1.5, '2', NaN, Infinity, null, Number.MAX_SAFE_INTEGER + 1])
      expect(() => service.page({ ...query, page })).toThrow()
    expect(() => service.page({ ...query, from: '2026-11-01' })).toThrow()
    expect(() => service.page({ ...query, characterId: 'invalid' })).toThrow()
  })
  it('페이지 이동은 작은 집계를 재사용하고 필터 변경·장부 변경은 다시 집계한다', () => {
    const spy = vi.spyOn(repository, 'summaryEntries')
    const first = service.page({ ...query, page: 1 })
    service.page({ ...query, page: 2 })
    expect(spy).toHaveBeenCalledTimes(1)
    const changed = first.entries.find((entry) => entry.direction === 'income')!
    database.prepare('UPDATE ledger_entries SET amount = amount + 10 WHERE id = ?').run(changed.id)
    expect(service.page({ ...query, page: 2 }).summary.income).toBe(first.summary.income + 10)
    expect(spy).toHaveBeenCalledTimes(2)
    service.page({ ...query, characterId: ids[1], page: 1 })
    expect(spy).toHaveBeenCalledTimes(3)
    service.page({ ...query, page: 1 })
    expect(spy).toHaveBeenCalledTimes(4)
  })
  it('마지막 한 건 삭제 후 이전 페이지로 이동하고 빈 장부는 첫 페이지로 맞춘다', () => {
    const last = service.page({ ...query, page: 3 }).entries[0]
    if (last.manualIncomeId)
      database.prepare('DELETE FROM manual_incomes WHERE id = ?').run(last.manualIncomeId)
    else database.prepare('DELETE FROM manual_expenses WHERE id = ?').run(last.manualExpenseId!)
    const page = service.page({ ...query, page: 3 })
    expect(page.pagination).toEqual({ page: 2, pageSize: 50, total: 100, totalPages: 2 })
    expect(page.entries).toHaveLength(50)
    database.exec('DELETE FROM ledger_entries')
    expect(service.page({ ...query, page: 3 }).pagination.page).toBe(1)
  })
  it('반환한 요약 수정은 캐시를 오염시키지 않고 정수 범위 초과는 거부한다', () => {
    const page = service.page({ ...query, page: 1 }),
      expected = structuredClone(page)
    page.summary.income = 0
    page.incomeGroups[0].amount = 0
    expect(service.page({ ...query, page: 1 })).toEqual(expected)
    database
      .prepare('UPDATE ledger_entries SET amount = ? WHERE id = ?')
      .run(Number.MAX_SAFE_INTEGER, 'synthetic-0000000')
    expect(() => service.page({ ...query, page: 1 })).toThrow('범위')
    database.prepare('UPDATE ledger_entries SET amount = 1 WHERE id = ?').run('synthetic-0000000')
    expect(service.page({ ...query, page: 1 }).summary).toEqual(service.list(query).summary)
  })
})

it('다른 SQLite 연결의 변경도 집계 캐시를 무효화한다', () => {
  const root = mkdtempSync(join(tmpdir(), 'maple-ledger-page-'))
  const path = join(root, 'synthetic.sqlite')
  const database = openDatabase(path),
    other = openDatabase(path)
  try {
    seedPerformanceLedger(database, 100)
    const service = new LedgerService(new LedgerRepository(database))
    const first = service.page({ ...query, page: 1 })
    other
      .prepare('UPDATE ledger_entries SET amount = amount + 123 WHERE id = ?')
      .run('synthetic-0000000')
    expect(service.page({ ...query, page: 1 }).summary.income).toBe(first.summary.income + 123)
  } finally {
    other.close()
    database.close()
    const target = resolve(root)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('maple-ledger-page-'))
      throw new Error('Unexpected test cleanup path')
    rmSync(target, { recursive: true, force: true })
  }
})
