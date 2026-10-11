import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardStats } from '../domain/dashboard'
import { seedPerformanceLedger } from './fixtures/ledger-performance'
import { groupLedgerIncome } from '../../shared/ledger-income'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { HuntingRepository } from '../modules/hunting/hunting.repository'
import { HuntingService } from '../modules/hunting/hunting.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { DropRepository } from '../modules/drops/drop.repository'
import { DropService } from '../modules/drops/drop.service'

describe('조회 조건을 반영하는 거래 CSV', () => {
  let database: DatabaseSync, ledger: LedgerService, first: string, second: string
  beforeEach(() => {
    database = openDatabase(':memory:')
    const chars = new CharacterRepository(database),
      ledgers = new LedgerRepository(database),
      hunts = new HuntingRepository(database),
      bosses = new BossRepository(database),
      drops = new DropRepository(database),
      tx = new UnitOfWork(database),
      now = () => new Date('2026-10-15T00:00:00Z')
    const characters = new CharacterService(chars)
    first = characters.create({ name: '첫캐릭터', world: '루나' }).id
    second = characters.create({ name: '둘째캐릭터', world: '스카니아' }).id
    const hunting = new HuntingService(hunts, chars, ledgers, tx, drops, now)
    const bossService = new BossService(bosses, chars, ledgers, tx, drops, now)
    const dropService = new DropService(drops, hunts, bosses, ledgers, tx, now)
    for (const [characterId, date] of [
      [first, '2026-10-08'],
      [second, '2026-10-09'],
      [first, '2026-09-01']
    ] as const)
      hunting.create({
        requestId: randomUUID(),
        characterId,
        date,
        minutes: 60,
        mesos: 1000,
        cost: 100,
        solFragments: 0,
        nodestones: 0,
        notes: ''
      })
    const run = bossService.createRun({
      characterId: first,
      date: '2026-10-15',
      bossName: '스우',
      difficulty: '노멀',
      partySize: 2
    })
    bossService.setClear({ id: run.id, isCleared: true })
    const lot = dropService.createLot({
      requestId: randomUUID(),
      source: { kind: 'boss', id: run.id },
      itemName: '보스 드랍',
      quantity: 3,
      estimatedUnitPrice: 100,
      notes: ''
    })
    dropService.createSale({
      requestId: randomUUID(),
      lotId: lot.id,
      date: '2026-10-15',
      quantity: 1,
      grossAmount: 1000,
      feeAmount: 0,
      partySize: 2,
      shareMode: 'equal',
      manualShare: null
    })
    ledger = new LedgerService(ledgers)
  })
  afterEach(() => database.close())
  it('기간·캐릭터·수입일을 적용하고 모든 캐릭터를 전체 내보내기에 포함한다', () => {
    const before = database.prepare('SELECT * FROM ledger_entries ORDER BY id').all()
    const query = { from: '2026-10-01', to: '2026-10-15' }
    const all = ledger.exportCsv(query),
      single = ledger.exportCsv({ ...query, characterId: first })
    expect(all.count).toBe(6)
    expect(single.count).toBe(4)
    expect(all.content).toContain('둘째캐릭터')
    expect(single.content).not.toContain('둘째캐릭터')
    expect(all.content).not.toContain('2026-09-01')
    expect(single.content).toContain('결정 수익')
    expect(single.content).toContain('드랍 판매')
    expect(ledger.exportCsv({ from: '2026-10-15', to: '2026-10-15' }).count).toBe(2)
    expect(database.prepare('SELECT * FROM ledger_entries ORDER BY id').all()).toEqual(before)
  })
  it('잘못된 조회 조건을 거부하고 빈 조회는 헤더만 내보낸다', () => {
    expect(() => ledger.exportCsv({ from: '2026-10-16', to: '2026-10-01' })).toThrow('시작일')
    expect(() => ledger.exportCsv({ from: '2026-02-30', to: '2026-10-01' })).toThrow()
    expect(() =>
      ledger.exportCsv({ from: '2026-10-01', to: '2026-10-15', characterId: 'invalid' })
    ).toThrow()
    expect(ledger.exportCsv({ from: '2026-08-01', to: '2026-08-31' })).toMatchObject({ count: 0 })
  })
  it('대시보드도 같은 기간·캐릭터 필터와 수익일을 사용하고 원본 장부를 보존한다', () => {
    const query = { from: '2026-10-01', to: '2026-10-15' }
    const all = ledger.dashboard(query),
      single = ledger.dashboard({ ...query, characterId: first })
    expect(all.summary).toEqual(ledger.list(query).summary)
    expect(all.characters).toHaveLength(2)
    expect(single.characters).toHaveLength(1)
    expect(single.characters[0].characterId).toBe(first)
    expect(single.sources.find((row) => row.source === 'crystal')?.income).toBe(4175000)
    expect(single.sources.find((row) => row.source === 'drop')?.income).toBe(500)
    expect(single.trend.find((row) => row.period === '2026-10-15')?.income).toBe(4175500)
    expect(ledger.dashboard({ from: '2026-08-01', to: '2026-08-31' }).summary.count).toBe(0)
    expect(() => ledger.dashboard({ from: '2026-10-16', to: '2026-10-01' })).toThrow('시작일')
  })
  it('전체 상세 조회와 대시보드의 집계·최근 거래가 모든 필터에서 동일하다', () => {
    for (const query of [
      { from: '2026-09-01', to: '2026-10-15' },
      { from: '2026-01-01', to: '2026-12-31' },
      { from: '2026-10-01', to: '2026-10-15', characterId: first },
      { from: '2026-10-09', to: '2026-10-09', characterId: second },
      { from: '2026-08-01', to: '2026-08-31' }
    ])
      expect(ledger.dashboard(query)).toEqual(dashboardStats(ledger.list(query), query))
  })
  it('페이지 조회도 결정·보스 드랍·과거 사냥 지출의 분류를 유지한다', () => {
    const query = { from: '2026-09-01', to: '2026-10-15' }
    const full = ledger.list(query),
      page = ledger.page({ ...query, page: 1 })
    expect(page.summary).toEqual(full.summary)
    expect(page.incomeGroups).toEqual(groupLedgerIncome(full.entries))
    expect(page.entries).toEqual(
      full.entries.filter(
        (entry) => entry.direction === 'expense' || entry.source === 'manualIncome'
      )
    )
    expect(page.entries.every((entry) => entry.activity === 'hunting')).toBe(true)
  })
  it('대시보드에서는 상세 정보 조회를 5건으로 제한하고 CSV는 전체를 내보낸다', () => {
    const repository = new LedgerRepository(database)
    const service = new LedgerService(repository)
    const spy = vi.spyOn(repository, 'list')
    const query = { from: '2026-09-01', to: '2026-10-15' }
    expect(service.dashboard(query).summary.count).toBe(8)
    expect(spy).toHaveBeenCalledExactlyOnceWith(query, 5)
    expect(service.exportCsv(query).count).toBe(8)
    expect(spy).toHaveBeenLastCalledWith(query)
  })
  it('많은 기록·수동 거래·서버 이동·최근 거래 동률 정렬을 유지한다', () => {
    const ids = seedPerformanceLedger(database, 1000)
    database
      .prepare("UPDATE ledger_entries SET world_snapshot = '레드' WHERE id = 'synthetic-0000997'")
      .run()
    const query = { from: '2026-10-01', to: '2026-10-31' }
    const before = ledger.exportCsv(query)
    for (const filter of [query, { ...query, characterId: ids[1] }]) {
      const list = ledger.list(filter)
      expect(ledger.dashboard(filter)).toEqual(dashboardStats(list, filter))
      expect(ledger.dashboard(filter).summary).toEqual(list.summary)
    }
    expect(
      ledger.dashboard(query).characters.find((row) => row.characterId === ids[1])?.worlds
    ).toContain('레드')
    expect(ledger.exportCsv(query)).toEqual(before)
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
  it('소수점 반올림 없이 큰 정수를 집계하고 합계 범위 초과를 거부한다', () => {
    const query = { from: '2026-09-01', to: '2026-10-15' }
    const row = database
      .prepare('SELECT id FROM ledger_entries WHERE direction = ? LIMIT 1')
      .get('income')!
    database
      .prepare('UPDATE ledger_entries SET amount = ? WHERE id = ?')
      .run(Number.MAX_SAFE_INTEGER - 100000000, row.id)
    expect(ledger.dashboard(query)).toEqual(dashboardStats(ledger.list(query), query))
    database
      .prepare('UPDATE ledger_entries SET amount = ? WHERE id = ?')
      .run(Number.MAX_SAFE_INTEGER, row.id)
    expect(() => ledger.dashboard(query)).toThrow('범위')
    expect(() => ledger.list(query)).toThrow('범위')
    // A failed aggregation must release its iterator and permit the next read/write.
    database.prepare('UPDATE ledger_entries SET amount = ? WHERE id = ?').run(1000, row.id)
    expect(ledger.dashboard(query).summary.count).toBe(8)
  })
})
