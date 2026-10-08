import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { CrystalPriceService } from '../modules/prices/crystal-price.service'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { DropRepository } from '../modules/drops/drop.repository'
import { UnitOfWork } from '../database/unit-of-work'
import { findCrystalPrice } from '../../shared/crystal-prices'
import { BackupService } from '../modules/backup/backup.service'
import { migrate } from '../database/migrate'
import { BossRosterService } from '../modules/bosses/boss-roster.service'
import { BossSyncService } from '../modules/bosses/boss-sync.service'
import { NexonClient } from '../integrations/nexon/nexon.client'

describe('결정석 가격 이력 관리', () => {
  let db: DatabaseSync, prices: CrystalPriceService, bosses: BossService, characterId: string
  const now = () => new Date('2026-10-15T00:00:00Z')
  const input = {
    bossName: '스우',
    difficulty: '노멀',
    amount: 10000000,
    effectiveOn: '2026-10-08',
    checkedOn: '2026-10-15',
    source: '게임 내 직접 확인'
  }
  const query = { date: '2026-10-08' }
  beforeEach(() => {
    db = openDatabase(':memory:')
    prices = new CrystalPriceService(db, now)
    const chars = new CharacterRepository(db)
    characterId = new CharacterService(chars).create({ name: '가격표캐릭터', world: '루나' }).id
    bosses = new BossService(
      new BossRepository(db),
      chars,
      new LedgerRepository(db),
      new UnitOfWork(db),
      new DropRepository(db),
      now,
      () => prices.custom()
    )
  })
  afterEach(() => db.close())
  const lookup = (date: string) => findCrystalPrice('스우', '노멀', date, prices.custom())
  const run = () =>
    bosses.createRun({
      characterId,
      date: query.date,
      bossName: '스우',
      difficulty: '노멀',
      partySize: 2
    })
  it('묶음 할당과 API 자동 등록에도 수동 가격 이력을 적용한다', async () => {
    prices.save(input)
    const chars = new CharacterRepository(db),
      repo = new BossRepository(db)
    const rosters = new BossRosterService(db, repo, chars, new UnitOfWork(db), now, () =>
      prices.custom()
    )
    const template = rosters.saveTemplate({
      name: '가격표 구성',
      members: [{ bossName: '스우', difficulty: '노멀', partySize: 2 }]
    })
    rosters.assign({ templateId: template.id, characterIds: [characterId] })
    expect(bosses.presets(characterId)[0].crystalPrice).toBe(10000000)
    chars.saveProfile(characterId, {
      ocid: 'fake-price-ocid',
      name: '가격표캐릭터',
      world: '루나',
      level: 280,
      job: '아크',
      guild: '',
      fetchedAt: now().toISOString()
    })
    const transport: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          date: '2026-10-15T00:00+09:00',
          boss_contents: [
            {
              content_name: '스우',
              difficulty: 'normal',
              cycle: 'bossWeekly',
              complete_flag: 'true'
            }
          ]
        })
      )
    const sync = new BossSyncService(
      new NexonClient(() => 'fake-key', transport, 0),
      chars,
      bosses,
      now,
      () => prices.custom()
    )
    await sync.syncAll({ date: '2026-10-15' })
    expect(bosses.list({ date: '2026-10-15' }).runs[0]).toMatchObject({
      crystalPrice: 10000000,
      settlement: { amount: 10000000 }
    })
    prices.save({ ...input, amount: 20000000 })
    await sync.syncAll({ date: '2026-10-15' })
    expect(bosses.list({ date: '2026-10-15' }).runs[0].settlement?.amount).toBe(10000000)
  })
  it('적용일 경계·미래 이력·같은 날짜 수동 우선·동일 키 교체를 처리한다', () => {
    prices.save(input)
    expect(lookup('2026-10-07')?.amount).toBe(8350000)
    expect(lookup('2026-10-08')?.amount).toBe(10000000)
    prices.save({ ...input, effectiveOn: '2026-10-22', amount: 12000000 })
    expect(lookup('2026-10-15')?.amount).toBe(10000000)
    expect(lookup('2026-10-22')?.amount).toBe(12000000)
    const id = prices.custom().find((row) => row.effectiveOn === input.effectiveOn)!.id
    prices.save({ ...input, amount: 11000000 })
    expect(prices.custom()).toHaveLength(2)
    expect(prices.custom().find((row) => row.id === id)?.amount).toBe(11000000)
    prices.save({ ...input, effectiveOn: '2026-09-17', amount: 9000000 })
    expect(lookup('2026-09-17')?.amount).toBe(9000000)
    expect(lookup('2026-09-16')?.amount).toBe(16700000)
  })
  it('새 기록·프리셋은 새 가격을 사용하고 가격 수정·삭제·반복 생성은 기존 기록과 수익을 보존한다', () => {
    const original = run()
    bosses.setClear({ id: original.id, isCleared: true })
    prices.save(input)
    const preset = bosses.createPreset({
      characterId,
      bossName: '스우',
      difficulty: '노멀',
      partySize: 2
    })
    expect(preset.crystalPrice).toBe(10000000)
    bosses.generate(query)
    let old = bosses.list(query).runs[0]
    expect(old.crystalPrice).toBe(8350000)
    old = bosses.updateRun({ ...old, notes: '가격표 변경 후 메모' })
    expect(old.settlement?.amount).toBe(4175000)
    const fresh = bosses.createRun({
      characterId,
      date: '2026-10-15',
      bossName: '스우',
      difficulty: '노멀',
      partySize: 2
    })
    expect(fresh.crystalPrice).toBe(10000000)
    prices.remove(prices.custom()[0].id)
    expect(lookup('2026-10-15')?.amount).toBe(8350000)
    expect(bosses.list({ date: '2026-10-15' }).runs[0].crystalPrice).toBe(10000000)
    expect(bosses.list(query).runs[0].settlement?.amount).toBe(4175000)
  })
  it('수동 가격표를 백업·복원하고 이전 8번 백업에는 빈 수동 이력을 적용한다', () => {
    prices.save(input)
    run()
    const backup = new BackupService(db, () => '/fake/recovery.json', now),
      content = backup.export()
    prices.remove(prices.custom()[0].id)
    backup.restore({ previewId: backup.prepare(content, '새버전.json').id })
    expect(prices.custom()[0]).toMatchObject(input)
    const file = JSON.parse(content)
    file.schemaVersion = 8
    delete file.tables.crystal_price_history
    delete file.tables.manual_expenses
    for (const row of file.tables.ledger_entries) delete row.manual_expense_id
    backup.restore({ previewId: backup.prepare(JSON.stringify(file), '이전버전.json').id })
    expect(prices.custom()).toEqual([])
    expect(bosses.list(query).runs[0].crystalPrice).toBe(10000000)
  })
  it('잘못된 가격·날짜·출처·보스와 기본 이력 삭제를 거부한다', () => {
    for (const patch of [
      { amount: 0 },
      { amount: -1 },
      { amount: 1.5 },
      { amount: Number.MAX_SAFE_INTEGER + 1 },
      { effectiveOn: '2026-02-30' },
      { checkedOn: '2026-10-16' },
      { source: '' },
      { bossName: '없는 보스' }
    ])
      expect(() => prices.save({ ...input, ...patch })).toThrow()
    expect(() => prices.remove(prices.list().find((row) => !row.isCustom)!.id)).toThrow()
    expect(prices.custom()).toEqual([])
    prices.save(input)
    const backup = new BackupService(db, () => '/fake/recovery.json', now),
      file = JSON.parse(backup.export())
    file.tables.crystal_price_history[0].amount = 0
    expect(() => backup.prepare(JSON.stringify(file), '오류.json')).toThrow()
  })
  it('이전 DB를 갱신해도 수동 가격표는 비어 있고 기존 장부는 보존한다', () => {
    const original = run()
    db.exec('DROP TABLE crystal_price_history; DELETE FROM schema_migrations WHERE version=9')
    migrate(db)
    expect(prices.custom()).toEqual([])
    expect(bosses.list(query).runs[0]).toEqual(original)
  })
})
