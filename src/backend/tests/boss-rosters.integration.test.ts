import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { BossRosterService } from '../modules/bosses/boss-roster.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { DropRepository } from '../modules/drops/drop.repository'
import { WEEKLY_BOSSES } from '../../shared/boss-catalog'
import type { BossMember } from '../../shared/contracts/boss-roster.contract'

describe('보스 묶음과 캐릭터별 독립 할당', () => {
  let directory: string,
    db: DatabaseSync,
    rosters: BossRosterService,
    bosses: BossService,
    characters: CharacterService,
    first: string,
    second: string
  const clock = () => new Date('2026-10-08T03:00:00Z')
  const members: BossMember[] = [
    { bossName: '스우', difficulty: '익스트림', partySize: 2 },
    { bossName: '림보', difficulty: '노멀', partySize: 3 }
  ]
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-roster-group-'))
    db = openDatabase(join(directory, 'test.sqlite'))
    const chars = new CharacterRepository(db),
      repository = new BossRepository(db),
      transaction = new UnitOfWork(db)
    characters = new CharacterService(chars)
    first = characters.create({ name: '캐릭터1', world: '루나' }).id
    second = characters.create({ name: '캐릭터2', world: '루나' }).id
    rosters = new BossRosterService(db, repository, chars, transaction, clock)
    bosses = new BossService(
      repository,
      chars,
      new LedgerRepository(db),
      transaction,
      new DropRepository(db),
      clock
    )
  })
  afterEach(() => {
    db.close()
    if (dirname(directory) !== tmpdir() || !basename(directory).startsWith('maple-roster-group-'))
      throw new Error('cleanup path')
    rmSync(directory, { recursive: true, force: true })
  })
  it('묶음을 여러 캐릭터에 복사하고 개별 난이도·보스 교체를 독립적으로 저장한다', () => {
    const template = rosters.saveTemplate({ name: '익세노흉', members })
    rosters.assign({ templateId: template.id, characterIds: [first, second] })
    rosters.saveRoster({
      characterId: first,
      members: [
        { bossName: '스우', difficulty: '하드', partySize: 1 },
        { bossName: '벨로나', difficulty: '이지', partySize: 3 }
      ]
    })
    expect(rosters.state().templates[0]).toEqual(template)
    expect(rosters.state().rosters.find((row) => row.characterId === second)?.members).toEqual(
      expect.arrayContaining(members)
    )
    expect(rosters.state().rosters.find((row) => row.characterId === first)?.customized).toBe(true)
    const runs = bosses.generate({ date: '2026-10-08' }).runs
    expect(runs).toHaveLength(4)
    expect(
      runs.find((row) => row.characterId === first && row.bossName === '벨로나')?.expectedShare
    ).toBe(132000000)
  })
  it('공용 묶음 수정·이름 변경·삭제가 할당본에 전파되지 않는다', () => {
    const template = rosters.saveTemplate({ name: '원본', members })
    rosters.assign({ templateId: template.id, characterIds: [first] })
    rosters.saveTemplate({ ...template, name: '바뀐 이름', members: [members[0]] })
    expect(rosters.state().rosters[0]).toMatchObject({
      name: '원본',
      members: expect.arrayContaining(members)
    })
    rosters.removeTemplate(template.id)
    expect(rosters.state().templates).toEqual([])
    expect(rosters.state().rosters[0]).toMatchObject({ templateId: null, name: '원본' })
    expect(bosses.presets(first)).toHaveLength(2)
  })
  it('재할당은 현재 구성만 교체하고 생성된 주차와 정산 ID·금액은 유지한다', () => {
    const template = rosters.saveTemplate({ name: '원본', members })
    rosters.assign({ templateId: template.id, characterIds: [first] })
    const run = bosses.generate({ date: '2026-10-08' }).runs[0]
    bosses.setClear({ id: run.id, isCleared: true })
    const sold = bosses.settle({ runId: run.id, date: '2026-10-08', amount: 123 })
    rosters.saveTemplate({
      ...template,
      members: [{ bossName: '카링', difficulty: '이지', partySize: 1 }]
    })
    rosters.assign({ templateId: template.id, characterIds: [first] })
    expect(
      bosses.list({ date: '2026-10-08' }).runs.find((row) => row.id === run.id)?.settlement
    ).toEqual(sold.settlement)
    expect(bosses.presets(first).map((row) => row.bossName)).toEqual(['카링'])
    expect(bosses.generate({ date: '2026-10-01' }).runs.map((row) => row.bossName)).toEqual([
      '카링'
    ])
  })
  it('12개 구성은 허용하고 13개·빈 구성·보스 중복을 거부한다', () => {
    const twelve = WEEKLY_BOSSES.slice(0, 12).map((boss) => ({
      bossName: boss.name,
      difficulty: boss.difficulties[0],
      partySize: 1
    }))
    expect(rosters.saveTemplate({ name: '12개', members: twelve }).members).toHaveLength(12)
    for (const invalid of [
      [],
      [...twelve, members[1]],
      [members[0], { ...members[0], difficulty: '노멀' }]
    ])
      expect(() => rosters.saveTemplate({ name: '오류', members: invalid })).toThrow()
    expect(rosters.state().templates).toHaveLength(1)
  })
  it('난이도·인원 검증 실패는 기존 구성을 지우지 않는다', () => {
    const template = rosters.saveTemplate({ name: '기본', members })
    rosters.assign({ templateId: template.id, characterIds: [first] })
    expect(() =>
      rosters.saveRoster({ characterId: first, members: [{ ...members[0], partySize: 3 }] })
    ).toThrow('최대 2명')
    expect(() =>
      rosters.saveTemplate({ ...template, members: [{ ...members[0], difficulty: '카오스' }] })
    ).toThrow('난이도')
    expect(bosses.presets(first)).toHaveLength(2)
  })
  it('없는 캐릭터·숨김 캐릭터가 섞인 일괄 할당은 전체 롤백한다', () => {
    const template = rosters.saveTemplate({ name: '기본', members })
    expect(() =>
      rosters.assign({ templateId: template.id, characterIds: [first, randomUUID()] })
    ).toThrow('찾을 수')
    expect(bosses.presets(first)).toEqual([])
    characters.setHidden({ id: second, isHidden: true })
    expect(() =>
      rosters.assign({ templateId: template.id, characterIds: [first, second] })
    ).toThrow('숨김')
    expect(rosters.state().rosters).toEqual([])
  })
  it('이전 DB의 보스 구성을 마이그레이션하고 과거 기록을 보존한다', () => {
    bosses.createPreset({ characterId: first, bossName: '스우', difficulty: '노멀', partySize: 3 })
    const run = bosses.generate({ date: '2026-10-08' }).runs[0]
    db.exec(
      'DROP TABLE boss_roster_assignments; DROP TABLE boss_templates; DELETE FROM schema_migrations WHERE version=5'
    )
    db.close()
    db = openDatabase(join(directory, 'test.sqlite'))
    const migrated = new BossRosterService(
      db,
      new BossRepository(db),
      new CharacterRepository(db),
      new UnitOfWork(db),
      clock
    )
    expect(migrated.state().rosters[0]).toMatchObject({
      name: '기존 보스 구성',
      customized: true,
      members: [{ bossName: '스우', difficulty: '노멀', partySize: 3 }]
    })
    expect(new BossRepository(db).list('2026-10-08')[0]).toEqual(run)
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
