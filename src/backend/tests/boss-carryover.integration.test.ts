import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { BossService } from '../modules/bosses/boss.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { CharacterService } from '../modules/characters/character.service'
import { CharacterRepository } from '../modules/characters/character.repository'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { DropRepository } from '../modules/drops/drop.repository'
import { BackupService } from '../modules/backup/backup.service'
import { WEEKLY_BOSSES } from '../../shared/boss-catalog'

describe('목요일 주간 보스 목록 이어받기', () => {
  let db: DatabaseSync, bosses: BossService, characterId: string, now: Date
  const service = () =>
    new BossService(
      new BossRepository(db),
      new CharacterRepository(db),
      new LedgerRepository(db),
      new UnitOfWork(db),
      new DropRepository(db),
      () => now
    )
  beforeEach(() => {
    db = openDatabase(':memory:')
    now = new Date('2026-10-14T14:59:59Z') // 수요일 23:59:59 KST
    characterId = new CharacterService(new CharacterRepository(db)).create({
      name: '이어받기',
      world: '레드'
    }).id
    bosses = service()
  })
  afterEach(() => db.close())
  const add = (bossName = '스우', date = '2026-10-08', difficulty = '하드', partySize = 3) =>
    bosses.createRun({ characterId, date, bossName, difficulty, partySize })
  const thursday = () => {
    now = new Date('2026-10-14T15:00:00Z')
  }

  it('목요일 0시에 전주 클리어만 복사하고 클리어·수익·메모는 초기화한다', () => {
    const cleared = add()
    bosses.updateRun({ ...cleared, notes: '지난주 메모' })
    bosses.setClear({ id: cleared.id, isCleared: true })
    add('데미안')
    const before = db.prepare('SELECT * FROM ledger_entries').all()
    expect(bosses.list({ date: '2026-10-14' }).runs).toHaveLength(2)
    expect(bosses.list({ date: '2026-10-15' }).runs).toHaveLength(0)
    thursday()
    const list = bosses.list({ date: '2026-10-15' })
    expect(list.runs).toHaveLength(1)
    expect(list.runs[0]).toMatchObject({
      bossName: '스우',
      difficulty: '하드',
      partySize: 3,
      isCleared: false,
      notes: '',
      settlement: null,
      week: '2026-10-15'
    })
    expect(list.runs[0].id).not.toBe(cleared.id)
    expect(list.summary).toMatchObject({ cleared: 0, settled: 0 })
    expect(db.prepare('SELECT * FROM ledger_entries').all()).toEqual(before)
    expect(
      bosses.list({ date: '2026-10-08' }).runs.find((run) => run.id === cleared.id)?.isCleared
    ).toBe(true)
  })

  it('12개 목록을 준비하고 조회·서비스 재생성 뒤에도 삭제한 보스를 되살리지 않는다', () => {
    for (const boss of WEEKLY_BOSSES.slice(0, 12)) {
      const run = add(boss.name, '2026-10-08', boss.difficulties[0], 1)
      bosses.setClear({ id: run.id, isCleared: true })
    }
    thursday()
    const list = bosses.list({ date: '2026-10-15', characterId })
    expect(list.runs).toHaveLength(12)
    expect(list.runs.every((run) => !run.isCleared && !run.settlement)).toBe(true)
    bosses.removeRun(list.runs[0].id)
    bosses = service()
    const updated = bosses.list({ date: '2026-10-15' })
    expect(updated.runs).toHaveLength(11)
    expect(updated.runs.some((run) => run.bossName === list.runs[0].bossName)).toBe(false)
  })

  it('이번 주 수동 기록·난이도·완료·수익을 유지하고 다른 캐릭터도 필터와 무관하게 준비한다', () => {
    const first = add()
    bosses.setClear({ id: first.id, isCleared: true })
    const other = new CharacterService(new CharacterRepository(db)).create({
      name: '다른캐릭터',
      world: '루나'
    })
    const previous = bosses.createRun({
      characterId: other.id,
      date: '2026-10-08',
      bossName: '데미안',
      difficulty: '노멀',
      partySize: 1
    })
    bosses.setClear({ id: previous.id, isCleared: true })
    thursday()
    const manual = add('스우', '2026-10-15', '노멀', 1)
    const completed = bosses.setClear({ id: manual.id, isCleared: true })
    expect(bosses.list({ date: '2026-10-15', characterId }).runs).toEqual([completed])
    expect(bosses.list({ date: '2026-10-15', characterId: other.id }).runs).toHaveLength(1)
  })

  it('월간·미래·과거 조회와 지난주 클리어가 없는 캐릭터는 자동 생성하지 않는다', () => {
    const monthly = bosses.createRun({
      characterId,
      date: '2026-10-08',
      cycle: 'monthly',
      bossName: '검은 마법사',
      difficulty: '하드',
      partySize: 1
    })
    bosses.setClear({ id: monthly.id, isCleared: true })
    const older = add('스우', '2026-10-01')
    bosses.setClear({ id: older.id, isCleared: true })
    add('데미안')
    thursday()
    expect(bosses.list({ date: '2026-10-15' }).runs).toHaveLength(0)
    expect(bosses.list({ date: '2026-10-22' }).runs).toHaveLength(0)
    expect(bosses.list({ date: '2026-10-08' }).runs).toHaveLength(1)
    expect(bosses.list({ date: '2026-11-01', cycle: 'monthly' }).runs).toHaveLength(0)
    expect(db.prepare('SELECT * FROM boss_week_carryovers').all()).toHaveLength(0)
  })

  it('자동 생성 이후 삭제한 목록은 백업 복원 후에도 재생성하지 않고 이전 버전 백업도 복원한다', () => {
    const run = add()
    bosses.setClear({ id: run.id, isCleared: true })
    thursday()
    const current = bosses.list({ date: '2026-10-15' }).runs[0]
    bosses.removeRun(current.id)
    const backup = new BackupService(
      db,
      () => 'recovery.json',
      () => now
    )
    const content = backup.export()
    backup.restore({ previewId: backup.prepare(content, '이번주.json').id })
    expect(service().list({ date: '2026-10-15' }).runs).toHaveLength(0)
    const legacy = JSON.parse(content)
    legacy.schemaVersion = 16
    delete legacy.tables.boss_week_carryovers
    backup.restore({ previewId: backup.prepare(JSON.stringify(legacy), '이전버전.json').id })
    expect(service().list({ date: '2026-10-15' }).runs).toHaveLength(1)
  })
})
