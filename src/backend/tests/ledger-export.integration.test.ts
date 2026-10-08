import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
    characters.setHidden({ id: second, isHidden: true })
    ledger = new LedgerService(ledgers)
  })
  afterEach(() => database.close())
  it('기간·캐릭터·수입일을 적용하고 숨긴 캐릭터도 전체 내보내기에 포함한다', () => {
    const before = database.prepare('SELECT * FROM ledger_entries ORDER BY id').all()
    const query = { from: '2026-10-01', to: '2026-10-15' }
    const all = ledger.exportCsv(query),
      single = ledger.exportCsv({ ...query, characterId: first })
    expect(all.count).toBe(6)
    expect(single.count).toBe(4)
    expect(all.content).toContain('둘째캐릭터')
    expect(single.content).not.toContain('둘째캐릭터')
    expect(all.content).not.toContain('2026-09-01')
    expect(single.content).toContain('결정석 수익')
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
})
