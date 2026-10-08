import { DropRepository } from '../modules/drops/drop.repository'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { HuntingRepository } from '../modules/hunting/hunting.repository'
import type { Character } from '../../shared/contracts/character.contract'
import type { BossPresetInput } from '../../shared/contracts/boss.contract'
import { bossWeek } from '../../shared/boss-period'
import { getKstDate } from '../../shared/dates'
import { crystalShare } from '../domain/boss-profit'
import { WEEKLY_BOSSES } from '../../shared/boss-catalog'
import charactersSql from '../database/migrations/001_characters.sql?raw'
import huntingSql from '../database/migrations/002_hunting_ledger.sql?raw'
import { migrate } from '../database/migrate'

describe('주간 보스와 결정석 장부', () => {
  let directory: string
  let database: DatabaseSync
  let characters: CharacterService
  let character: Character
  let bosses: BossService
  let ledger: LedgerService
  const clock = () => new Date('2026-10-15T00:00:00Z')
  const query = { date: '2026-10-08' }
  const month = { from: '2026-10-01', to: '2026-10-15' }
  it('기존 DB를 갱신할 때 인원·수익을 보존하고 과거 기록은 미확인으로 추정하지 않는다', () => {
    const original = bosses.createRun({
      characterId: character.id,
      date: query.date,
      bossName: '스우',
      difficulty: '노멀',
      partySize: 2
    })
    bosses.setClear({ id: original.id, isCleared: true })
    const entries = ledger.list(month).entries
    database.exec(
      'ALTER TABLE boss_runs DROP COLUMN party_size_needs_review; DELETE FROM schema_migrations WHERE version=8'
    )
    migrate(database)
    expect(bosses.list(query).runs[0]).toMatchObject({
      id: original.id,
      partySize: 2,
      partySizeNeedsReview: false,
      isCleared: true
    })
    expect(ledger.list(month).entries).toEqual(entries)
  })
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-boss-test-'))
    database = openDatabase(join(directory, 'test.sqlite'))
    const repository = new CharacterRepository(database)
    characters = new CharacterService(repository)
    character = characters.create({ name: '보스캐릭터', world: '스카니아', notes: '' })
    const ledgerRepository = new LedgerRepository(database)
    ledger = new LedgerService(ledgerRepository)
    bosses = new BossService(
      new BossRepository(database),
      repository,
      ledgerRepository,
      new UnitOfWork(database),
      new DropRepository(database),
      clock
    )
  })
  afterEach(() => {
    database.close()
    if (!directory.startsWith(join(tmpdir(), 'maple-boss-test-')))
      throw new Error('unexpected cleanup path')
    rmSync(directory, { recursive: true, force: true })
  })
  const preset = (overrides: Partial<BossPresetInput> = {}) =>
    bosses.createPreset({
      characterId: character.id,
      bossName: '스우',
      difficulty: '노멀',
      partySize: 3,
      crystalPrice: 101,
      ...overrides
    })
  const run = () => {
    preset()
    return bosses.generate(query).runs[0]
  }
  const cleared = () => {
    const record = run()
    return bosses.setClear({ id: record.id, isCleared: true })
  }
  const sold = () => {
    const record = cleared()
    return bosses.settle({ runId: record.id, date: '2026-10-13', amount: 60 })
  }
  it('반영일만 변경하면 자동 수익·거래 ID·인원 확인 상태를 보존하고 날짜별 집계만 이동한다', () => {
    const record = cleared()
    database.prepare('UPDATE boss_runs SET party_size_needs_review=1 WHERE id=?').run(record.id)
    const before = bosses.list(query).runs[0],
      entry = ledger.list(month).entries[0]
    const updated = bosses.updateIncomeDate({
      id: record.id,
      date: '2026-10-13',
      expectedDate: record.settlement!.date,
      amount: 1,
      partySize: 1
    })
    expect(updated).toMatchObject({
      week: before.week,
      partySize: before.partySize,
      partySizeNeedsReview: true,
      crystalPrice: before.crystalPrice,
      notes: before.notes,
      settlement: {
        id: before.settlement!.id,
        date: '2026-10-13',
        amount: before.settlement!.amount
      }
    })
    expect(new BossRepository(database).isAutomatic(record.id)).toBe(true)
    expect(ledger.list(month).entries).toEqual([{ ...entry, date: '2026-10-13' }])
    expect(ledger.list({ from: '2026-10-08', to: '2026-10-08' }).summary.income).toBe(0)
    expect(ledger.dashboard({ from: '2026-10-13', to: '2026-10-13' }).summary.income).toBe(
      before.settlement!.amount
    )
    expect(
      bosses.updateIncomeDate({ id: record.id, date: '2026-10-13', expectedDate: '2026-10-13' })
    ).toEqual(updated)
    expect(bosses.updateRun({ ...updated, partySize: 2 }).settlement?.amount).toBe(4175000)
  })
  it('수동 수익의 날짜를 수정해도 금액과 수동 상태를 유지하며 주차는 바꾸지 않는다', () => {
    const record = sold()
    const updated = bosses.updateIncomeDate({
      id: record.id,
      date: '2026-10-15',
      expectedDate: '2026-10-13'
    })
    expect(updated.week).toBe(record.week)
    expect(updated.settlement).toEqual({ ...record.settlement, date: '2026-10-15' })
    expect(new BossRepository(database).isAutomatic(record.id)).toBe(false)
    expect(bosses.updateRun({ ...updated, notes: '날짜 변경 후 메모' }).settlement?.amount).toBe(60)
  })
  it('미클리어·미래·주차 이전 날짜와 조회 후 변경된 날짜는 덮어쓰지 않는다', () => {
    const record = run()
    expect(() =>
      bosses.updateIncomeDate({ id: record.id, date: '2026-10-13', expectedDate: '2026-10-08' })
    ).toThrow('클리어 기록')
    const clearedRecord = bosses.setClear({ id: record.id, isCleared: true })
    for (const date of ['2026-10-07', '2026-10-16'])
      expect(() =>
        bosses.updateIncomeDate({
          id: record.id,
          date,
          expectedDate: clearedRecord.settlement!.date
        })
      ).toThrow('주차 시작일')
    bosses.updateIncomeDate({
      id: record.id,
      date: '2026-10-13',
      expectedDate: clearedRecord.settlement!.date
    })
    const entries = ledger.list(month).entries
    expect(() =>
      bosses.updateIncomeDate({
        id: record.id,
        date: '2026-10-14',
        expectedDate: clearedRecord.settlement!.date
      })
    ).toThrow('반영일이 변경')
    expect(ledger.list(month).entries).toEqual(entries)
  })
  it('날짜 수정 중 장부 저장에 실패하면 결정석 정산과 거래 날짜를 모두 되돌린다', () => {
    const record = cleared(),
      entries = ledger.list(month).entries
    database.exec(
      "CREATE TRIGGER reject_income_date BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT,'date failure'); END"
    )
    expect(() =>
      bosses.updateIncomeDate({
        id: record.id,
        date: '2026-10-13',
        expectedDate: record.settlement!.date
      })
    ).toThrow('date failure')
    expect(bosses.list(query).runs[0]).toEqual(record)
    expect(ledger.list(month).entries).toEqual(entries)
  })

  it('프리셋 없이 주차 보스를 추가하고 중복과 미래 주차를 막는다', () => {
    const input = {
      characterId: character.id,
      date: query.date,
      bossName: '스우',
      difficulty: '노멀',
      partySize: 3
    }
    const record = bosses.createRun(input)
    expect(record).toMatchObject({
      isCleared: false,
      settlement: null,
      expectedShare: 2783333,
      characterWorld: '스카니아'
    })
    expect(bosses.presets()).toEqual([])
    expect(ledger.list(month).entries).toEqual([])
    expect(() => bosses.createRun({ ...input, difficulty: '하드' })).toThrow('같은 보스')
    expect(() => bosses.createRun({ ...input, date: '2026-10-22' })).toThrow('미래 주차')
    characters.setHidden({ id: character.id, isHidden: true })
    expect(() => bosses.createRun({ ...input, bossName: '데미안' })).toThrow('숨김')
  })

  it('캐릭터별 주차 추가는 12개까지만 허용한다', () => {
    for (const boss of WEEKLY_BOSSES.slice(0, 12)) {
      bosses.createRun({
        characterId: character.id,
        date: query.date,
        bossName: boss.name,
        difficulty: boss.difficulties[0],
        partySize: 1
      })
    }
    expect(() =>
      bosses.createRun({
        characterId: character.id,
        date: query.date,
        bossName: '더스크',
        difficulty: '노멀',
        partySize: 1
      })
    ).toThrow('최대 12개')
    expect(bosses.list(query).runs).toHaveLength(12)
    preset({ bossName: '더스크' })
    expect(() => bosses.generate(query)).toThrow('12개를 초과')
    expect(bosses.list(query).runs).toHaveLength(12)
  })

  it('클리어한 보스를 교체하면 수익을 재계산하고 날짜와 거래 ID를 보존한다', () => {
    const record = cleared()
    const originalEntry = ledger.list(month).entries[0]
    const updated = bosses.updateRun({ ...record, bossName: '데미안' })
    expect(updated).toMatchObject({
      id: record.id,
      bossName: '데미안',
      isCleared: true,
      expectedShare: 2916666
    })
    expect(updated.settlement).toMatchObject({
      id: record.settlement!.id,
      date: record.settlement!.date,
      amount: 2916666
    })
    expect(ledger.list(month).entries).toHaveLength(1)
    expect(ledger.list(month).entries[0]).toMatchObject({ id: originalEntry.id, amount: 2916666 })
    expect(bosses.presets()[0].bossName).toBe('스우')
    bosses.createRun({
      characterId: character.id,
      date: query.date,
      bossName: '루시드',
      difficulty: '노멀',
      partySize: 1
    })
    expect(() => bosses.updateRun({ ...updated, bossName: '루시드' })).toThrow('같은 보스')
    expect(bosses.list(query).runs.find((row) => row.id === record.id)?.bossName).toBe('데미안')
    expect(ledger.list(month).entries[0].amount).toBe(2916666)
  })

  it.each([
    ['스우', '익스트림', 2],
    ['림보', '노멀', 3],
    ['최초의 대적자', '익스트림', 3],
    ['벨로나', '하드', 3],
    ['찬란한 흉성', '하드', 3],
    ['발드릭스', '하드', 3],
    ['유피테르', '하드', 3],
    ['카링', '익스트림', 6]
  ])('%s %s 인원 상한 %i명을 검증한다', (bossName, difficulty, maximum) => {
    expect(() => preset({ bossName, difficulty, partySize: maximum + 1 })).toThrow()
    expect(preset({ bossName, difficulty, partySize: maximum }).partySize).toBe(maximum)
  })
  it('난이도 변경과 직접 IPC 수정에서도 인원 상한을 검증한다', () => {
    const p = preset({ partySize: 6 })
    const record = bosses.generate(query).runs[0]
    expect(() => bosses.updatePreset({ ...p, difficulty: '익스트림' })).toThrow('최대 2명')
    expect(() => bosses.updateRun({ ...record, difficulty: '익스트림' })).toThrow('최대 2명')
    expect(
      bosses.updateRun({ ...record, difficulty: '익스트림', partySize: 2 }).expectedShare
    ).toBe(272500000)
  })
  it('기존 상한 초과 기록은 유지하되 새 초과 인원으로 수정하지 못한다', () => {
    const p = preset({ difficulty: '익스트림', partySize: 2 })
    database.prepare('UPDATE boss_presets SET party_size = 6 WHERE id = ?').run(p.id)
    const legacy = bosses.presets()[0]
    expect(bosses.updatePreset(legacy).partySize).toBe(6)
    expect(() => bosses.updatePreset({ ...legacy, partySize: 5 })).toThrow('최대 2명')
    const record = bosses.generate(query).runs[0]
    expect(bosses.updateRun({ ...record, notes: '기존 인원 유지' }).partySize).toBe(6)
    expect(bosses.updateRun({ ...record, partySize: 2 }).partySize).toBe(2)
  })
  it('입력 가격 대신 공식 가격을 적용하고 주차별 가격 변경을 구분한다', () => {
    expect(preset().crystalPrice).toBe(8350000)
    expect(bosses.generate({ date: '2026-09-10' }).runs[0].crystalPrice).toBe(16700000)
    expect(bosses.generate({ date: '2026-09-17' }).runs[0].crystalPrice).toBe(8350000)
    expect(() => bosses.generate({ date: '2026-06-11' })).toThrow('가격표')
  })
  it('가격표 이전 기존 주차는 반복 생성·메모 수정에서도 가격을 보존한다', () => {
    const record = run()
    database
      .prepare('UPDATE boss_runs SET period_start = ?, crystal_price = ? WHERE id = ?')
      .run('2026-06-11', 101, record.id)
    const oldQuery = { date: '2026-06-11' }
    const legacy = bosses.generate(oldQuery).runs[0]
    expect(bosses.updateRun({ ...legacy, notes: '과거 가격 유지' }).crystalPrice).toBe(101)
    expect(() => bosses.updateRun({ ...legacy, difficulty: '하드' })).toThrow('가격표')
  })

  it.each([
    { bossName: '스우', difficulty: '카오스' },
    { bossName: '데미안', difficulty: '익스트림' },
    { bossName: '감시자 칼로스', difficulty: '하드' },
    { bossName: '자쿰', difficulty: '노멀' },
    { bossName: '검은 마법사', difficulty: '하드' },
    { bossName: '없는 보스', difficulty: '노멀' }
  ])('목록에 없는 주간 보스·난이도 등록을 거부한다: %j', (selection) => {
    expect(() => preset(selection)).toThrow('목록에서 선택')
    expect(bosses.presets()).toHaveLength(0)
  })
  it('익스트림 스우와 카오스 칼로스를 선택해 저장하고 주차를 생성한다', () => {
    preset({ difficulty: '익스트림', partySize: 2 })
    preset({ bossName: '감시자 칼로스', difficulty: '카오스' })
    expect(
      bosses
        .generate(query)
        .runs.map((row) => `${row.bossName}:${row.difficulty}`)
        .sort()
    ).toEqual(['감시자 칼로스:카오스', '스우:익스트림'])
  })
  it('프리셋·주차 난이도 수정에서도 보스별 선택지를 검증한다', () => {
    const p = preset()
    const record = bosses.generate(query).runs[0]
    expect(() => bosses.updatePreset({ ...p, difficulty: '카오스' })).toThrow('난이도')
    expect(() => bosses.updateRun({ ...record, difficulty: '이지' })).toThrow('난이도')
    expect(bosses.presets()[0].difficulty).toBe('노멀')
    expect(bosses.list(query).runs[0].difficulty).toBe('노멀')
    bosses.updateRun({ ...record, difficulty: '익스트림', partySize: 2 })
    expect(bosses.list(query).runs[0].difficulty).toBe('익스트림')
  })
  it.each([
    ['스우', '노말'],
    ['기존수동보스', '기존난이도']
  ])('기존 자유 입력 %s:%s를 유지하며 금액·메모를 수정할 수 있다', (bossName, difficulty) => {
    const original = preset()
    database
      .prepare('UPDATE boss_presets SET boss_name = ?, boss_key = ?, difficulty = ? WHERE id = ?')
      .run(bossName, bossName, difficulty, original.id)
    const legacy = bosses.presets()[0]
    bosses.updatePreset({ ...legacy, crystalPrice: 500 })
    const record = bosses.generate(query).runs[0]
    bosses.updateRun({ ...record, notes: '기존 기록 유지', crystalPrice: original.crystalPrice })
    expect(bosses.list(query).runs[0]).toMatchObject({
      bossName,
      difficulty,
      notes: '기존 기록 유지',
      crystalPrice: original.crystalPrice
    })
    expect(() => bosses.updatePreset({ ...legacy, difficulty: '임의 난이도' })).toThrow(
      '목록에서 선택'
    )
    bosses.setClear({ id: record.id, isCleared: true })
    bosses.settle({ runId: record.id, date: '2026-10-13', amount: 60 })
    expect(ledger.list(month).summary.income).toBe(60)
  })

  it.each([
    ['2026-10-07', '2026-10-01'],
    ['2026-10-08', '2026-10-08'],
    ['2026-09-30', '2026-09-24'],
    ['2026-01-01', '2026-01-01'],
    ['2025-12-31', '2025-12-25']
  ])('목요일 기준 주차 %s → %s', (date, week) => expect(bossWeek(date)).toBe(week))
  it('KST 목요일 자정과 정수 파티 분배 경계를 처리한다', () => {
    expect(bossWeek(getKstDate(new Date('2026-10-07T14:59:59Z')))).toBe('2026-10-01')
    expect(bossWeek(getKstDate(new Date('2026-10-07T15:00:00Z')))).toBe('2026-10-08')
    expect(crystalShare(101, 3)).toBe(33)
    expect(crystalShare(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER)
  })
  it('같은 캐릭터·보스는 난이도가 달라도 중복 프리셋을 만들 수 없다', () => {
    preset()
    expect(() => preset({ bossName: ' 스우 ', difficulty: '하드' })).toThrow('기존 프리셋')
    const other = characters.create({ name: '다른캐릭터', world: '월드', notes: '' })
    preset({ characterId: other.id })
    expect(bosses.presets()).toHaveLength(2)
  })
  it('주차 반복 생성은 완료·판매·기록 ID를 덮어쓰지 않는다', () => {
    const record = sold()
    const again = bosses.generate(query).runs[0]
    expect(again.id).toBe(record.id)
    expect(again.isCleared).toBe(true)
    expect(again.settlement?.id).toBe(record.settlement?.id)
    expect(ledger.list(month).entries).toHaveLength(1)
  })
  it('프리셋 변경과 월드 이동이 기존 주차 스냅샷을 바꾸지 않는다', () => {
    const p = preset()
    const first = bosses.generate(query).runs[0]
    bosses.updatePreset({ ...p, difficulty: '하드', crystalPrice: 500, partySize: 1 })
    characters.update({ ...character, name: '이름변경', world: '루나' })
    expect(bosses.generate(query).runs[0]).toMatchObject({
      id: first.id,
      difficulty: '노멀',
      crystalPrice: 8350000,
      partySize: 3,
      characterName: '이름변경',
      characterWorld: '스카니아'
    })
    expect(bosses.generate({ date: '2026-10-15' }).runs[0]).toMatchObject({
      difficulty: '하드',
      crystalPrice: 48900000,
      partySize: 1,
      characterWorld: '루나'
    })
  })
  it('클리어 체크는 결정석 수입을 바로 장부에 반영한다', () => {
    cleared()
    expect(ledger.list(month).summary.income).toBe(2783333)
    expect(bosses.list(query).summary).toMatchObject({
      cleared: 1,
      settled: 2783333,
      remaining: 0
    })
  })
  it('중복 체크는 수익·거래 ID·반영일을 중복하거나 변경하지 않는다', () => {
    const record = cleared()
    const entry = ledger.list(month).entries[0]
    bosses.setClear({ id: record.id, isCleared: true })
    expect(ledger.list(month).entries).toEqual([entry])
    const updated = bosses.updateRun({
      ...record,
      partySize: 1,
      incomeDate: '2026-10-14',
      notes: '수정'
    })
    expect(updated.settlement).toMatchObject({
      id: record.settlement?.id,
      amount: 8350000,
      date: '2026-10-14'
    })
    expect(ledger.list(month).entries[0]).toMatchObject({
      id: entry.id,
      amount: 8350000,
      date: '2026-10-14'
    })
    expect(() => bosses.updateRun({ ...updated, incomeDate: '2026-10-16' })).toThrow('오늘 이후')
    expect(() => bosses.updateRun({ ...updated, incomeDate: '2026-10-07' })).toThrow('주차 시작일')
    expect(bosses.list(query).runs[0].settlement?.date).toBe('2026-10-14')
  })
  it('자동 수익 갱신 실패 시 인원과 수익도 함께 롤백한다', () => {
    const record = cleared()
    database.exec(
      "CREATE TRIGGER fail_auto_update BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => bosses.updateRun({ ...record, partySize: 1 })).toThrow('forced failure')
    expect(bosses.list(query).runs[0]).toMatchObject({
      partySize: 3,
      settlement: record.settlement
    })
    expect(ledger.list(month).summary.income).toBe(2783333)
  })
  it('기존 직접 입력 수령액·날짜는 메모 수정과 반복 체크에서 유지한다', () => {
    const record = sold()
    bosses.updateRun({ ...record, notes: '과거 수령액 보존' })
    bosses.setClear({ id: record.id, isCleared: true })
    expect(bosses.list(query).runs[0].settlement).toEqual(record.settlement)
    expect(ledger.list(month).summary.income).toBe(60)
    expect(() => bosses.updateRun({ ...record, incomeDate: '2026-10-16' })).toThrow('오늘 이후')
  })
  it('현재 주차는 오늘, 과거 주차는 주차 시작일에 수익을 반영한다', () => {
    preset()
    const current = bosses.generate({ date: '2026-10-15' }).runs[0]
    expect(bosses.setClear({ id: current.id, isCleared: true }).settlement?.date).toBe('2026-10-15')
    const old = bosses.generate({ date: '2026-09-24' }).runs[0]
    expect(bosses.setClear({ id: old.id, isCleared: true }).settlement?.date).toBe('2026-09-24')
  })
  it('수익이 0인 클리어도 완료 상태만 기록하고 거래는 만들지 않는다', () => {
    const record = run()
    database.prepare('UPDATE boss_runs SET crystal_price=0 WHERE id=?').run(record.id)
    const result = bosses.setClear({ id: record.id, isCleared: true })
    expect(result).toMatchObject({ isCleared: true, settlement: { amount: 0 } })
    expect(ledger.list(month).entries).toEqual([])
  })
  it('6번 전환은 미정산 클리어만 수익으로 채우고 기존 거래·금액·날짜를 보존한다', () => {
    preset()
    preset({ bossName: '데미안' })
    preset({ bossName: '자쿰', difficulty: '카오스' })
    preset({ bossName: '파풀라투스', difficulty: '카오스' })
    const rows = bosses.generate(query).runs
    const manual = rows.find((row) => row.bossName === '스우')!
    bosses.setClear({ id: manual.id, isCleared: true })
    bosses.settle({ runId: manual.id, date: '2026-10-13', amount: 60 })
    const entry = ledger.list(month).entries[0]
    const auto = rows.find((row) => row.bossName === '데미안')!
    const zero = rows.find((row) => row.bossName === '자쿰')!
    database
      .prepare('UPDATE boss_runs SET is_cleared=1, updated_at=? WHERE id=?')
      .run('2026-10-12T03:00:00Z', auto.id)
    database
      .prepare('UPDATE boss_runs SET is_cleared=1, crystal_price=0, updated_at=? WHERE id=?')
      .run('2026-10-15T03:00:00Z', zero.id)
    database.exec(
      'ALTER TABLE crystal_settlements DROP COLUMN is_automatic; DELETE FROM schema_migrations WHERE version=6'
    )
    database.close()
    database = openDatabase(join(directory, 'test.sqlite'))
    const migrated = new BossRepository(database)
    expect(migrated.find(auto.id)?.settlement).toMatchObject({
      amount: 2916666,
      date: '2026-10-12'
    })
    expect(migrated.find(zero.id)?.settlement).toMatchObject({ amount: 0, date: '2026-10-08' })
    expect(
      migrated.find(rows.find((row) => row.bossName === '파풀라투스')!.id)?.settlement
    ).toBeNull()
    expect(new LedgerRepository(database).list(month)).toEqual(expect.arrayContaining([entry]))
    expect(new LedgerRepository(database).list(month)).toHaveLength(2)
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
  it('판매 실제 수령액을 판매일 기준으로 한 번만 반영한다', () => {
    const record = sold()
    bosses.settle({ runId: record.id, date: '2026-10-13', amount: 60 })
    expect(ledger.list({ from: '2026-10-08', to: '2026-10-12' }).entries).toHaveLength(0)
    expect(ledger.list(month).summary.income).toBe(60)
    expect(ledger.list(month).entries[0]).toMatchObject({
      source: 'crystal',
      huntingSessionId: null,
      characterWorld: '스카니아',
      date: '2026-10-13'
    })
    expect(bosses.list(query).summary).toMatchObject({ sold: 1, clearedUnsold: 0, settled: 60 })
  })
  it('월을 넘긴 판매도 클리어 주차와 판매 집계를 분리한다', () => {
    preset()
    const record = bosses.generate({ date: '2026-09-24' }).runs[0]
    bosses.setClear({ id: record.id, isCleared: true })
    bosses.settle({ runId: record.id, date: '2026-10-01', amount: 70 })
    expect(bosses.list({ date: '2026-09-24' }).summary.settled).toBe(70)
    expect(bosses.list(query).summary.settled).toBe(0)
    expect(ledger.list(month).summary.income).toBe(70)
    expect(ledger.list({ from: '2026-09-01', to: '2026-09-30' }).summary.income).toBe(0)
  })
  it('판매 수정 시 정산과 거래 ID를 유지하고 0 메소 거래는 제거한다', () => {
    const record = sold()
    const original = ledger.list(month).entries[0]
    const updated = bosses.settle({ runId: record.id, date: '2026-10-14', amount: 80 })
    expect(updated.settlement?.id).toBe(record.settlement?.id)
    expect(ledger.list(month).entries[0]).toMatchObject({
      id: original.id,
      amount: 80,
      date: '2026-10-14'
    })
    bosses.settle({ runId: record.id, date: '2026-10-14', amount: 0 })
    expect(ledger.list(month).entries).toHaveLength(0)
    expect(bosses.list(query).summary.sold).toBe(1)
  })
  it('클리어 해제로 수입을 취소하고 재체크·인원 수정·삭제에 수입을 연동한다', () => {
    const record = sold()
    bosses.setClear({ id: record.id, isCleared: false })
    bosses.setClear({ id: record.id, isCleared: false })
    expect(ledger.list(month).entries).toHaveLength(0)
    expect(bosses.list(query).runs[0].isCleared).toBe(false)
    bosses.setClear({ id: record.id, isCleared: true })
    bosses.updateRun({ ...record, partySize: 1, crystalPrice: 90, notes: '수정' })
    expect(bosses.list(query).runs[0].expectedShare).toBe(8350000)
    expect(ledger.list(month).summary.income).toBe(8350000)
    bosses.removeRun(record.id)
    expect(bosses.list(query).runs).toHaveLength(0)
    expect(ledger.list(month).entries).toHaveLength(0)
    expect(bosses.presets()).toHaveLength(1)
  })
  it('숨긴 캐릭터는 새 주차에서 제외하고 기존 기록은 조회한다', () => {
    run()
    characters.setHidden({ id: character.id, isHidden: true })
    expect(bosses.generate({ date: '2026-10-15' }).runs).toHaveLength(0)
    expect(bosses.list({ ...query, characterId: character.id }).runs).toHaveLength(1)
    expect(() => preset({ bossName: '데미안' })).toThrow('숨김')
  })
  it('프리셋 삭제는 과거 기록을 유지하고 참조 캐릭터 삭제를 보호한다', () => {
    const record = run()
    bosses.removePreset(bosses.presets()[0].id)
    expect(bosses.list(query).runs).toHaveLength(1)
    expect(() => characters.remove(character.id)).toThrow('숨김 기능')
    bosses.removeRun(record.id)
    characters.remove(character.id)
    expect(characters.list()).toHaveLength(0)
  })
  it('미완료 기록의 판매, 과거·미래 판매일과 미래 주차 생성을 거부한다', () => {
    const record = run()
    expect(() => bosses.settle({ runId: record.id, date: '2026-10-13', amount: 60 })).toThrow(
      '클리어'
    )
    bosses.setClear({ id: record.id, isCleared: true })
    expect(() => bosses.settle({ runId: record.id, date: '2026-10-07', amount: 60 })).toThrow(
      '주차 시작일'
    )
    expect(() => bosses.settle({ runId: record.id, date: '2026-10-16', amount: 60 })).toThrow(
      '오늘 이후'
    )
    expect(() => bosses.generate({ date: '2026-10-22' })).toThrow('미래')
  })
  it.each([
    { partySize: 0 },
    { partySize: 7 },
    { partySize: 1.5 },
    { crystalPrice: -1 },
    { crystalPrice: Number.MAX_SAFE_INTEGER + 1 },
    { bossName: '' }
  ])('프리셋 입력 경계를 검증한다: %j', (overrides) => {
    expect(() => preset(overrides)).toThrow()
    expect(bosses.presets()).toHaveLength(0)
  })
  it('장부 저장 실패 시 결정석 정산도 되돌린다', () => {
    const record = run()
    database.exec(
      "CREATE TRIGGER fail_crystal BEFORE INSERT ON ledger_entries WHEN NEW.crystal_settlement_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => bosses.setClear({ id: record.id, isCleared: true })).toThrow('forced failure')
    expect(bosses.list(query).runs[0].settlement).toBeNull()
    expect(bosses.list(query).runs[0].isCleared).toBe(false)
    expect(ledger.list(month).entries).toHaveLength(0)
  })
  it('장부 수정 실패 시 판매일과 수령액을 되돌린다', () => {
    const record = sold()
    database.exec(
      "CREATE TRIGGER fail_update BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => bosses.settle({ runId: record.id, date: '2026-10-14', amount: 80 })).toThrow(
      'forced failure'
    )
    expect(bosses.list(query).runs[0].settlement).toMatchObject({ date: '2026-10-13', amount: 60 })
    expect(ledger.list(month).summary.income).toBe(60)
  })
  it('장부 삭제 실패 시 판매 취소를 되돌린다', () => {
    const record = sold()
    database.exec(
      "CREATE TRIGGER fail_delete BEFORE DELETE ON ledger_entries BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => bosses.cancelSale(record.id)).toThrow('forced failure')
    expect(bosses.list(query).runs[0].settlement?.amount).toBe(60)
    expect(ledger.list(month).summary.income).toBe(60)
  })
  it('2번 버전의 사냥·거래 ID와 금액을 유지하면서 보스 장부로 업그레이드한다', () => {
    const file = join(directory, 'legacy.sqlite')
    const old = new DatabaseSync(file)
    old.exec('PRAGMA foreign_keys = ON')
    old.exec(charactersSql)
    old.exec(huntingSql)
    old.exec(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT; INSERT INTO schema_migrations VALUES (1, 'characters', '2026-10-01'), (2, 'hunting_ledger', '2026-10-01')"
    )
    const oldCharacters = new CharacterService(new CharacterRepository(old))
    const oldCharacter = oldCharacters.create({ name: '기존캐릭터', world: '루나', notes: '' })
    const session = {
      id: randomUUID(),
      characterId: oldCharacter.id,
      date: '2026-10-08',
      minutes: 60,
      mesos: 1000,
      cost: 100,
      solFragments: 1,
      nodestones: 0,
      notes: '',
      characterName: oldCharacter.name,
      characterWorld: oldCharacter.world,
      net: 900,
      hourlyNet: 900,
      saleIncome: 0,
      createdAt: clock().toISOString(),
      updatedAt: clock().toISOString()
    }
    new HuntingRepository(old).insert(session)
    new LedgerRepository(old).syncHunting(session)
    const entryIds = old
      .prepare('SELECT id FROM ledger_entries ORDER BY id')
      .all()
      .map((row) => row.id)
    old.close()
    const upgraded = openDatabase(file)
    try {
      expect(upgraded.prepare('SELECT * FROM schema_migrations').all()).toHaveLength(10)
      expect(
        upgraded
          .prepare('SELECT id FROM ledger_entries ORDER BY id')
          .all()
          .map((row) => row.id)
      ).toEqual(entryIds)
      expect(new HuntingRepository(upgraded).find(session.id)?.mesos).toBe(1000)
      expect(new LedgerService(new LedgerRepository(upgraded)).list(month).summary.net).toBe(900)
      expect(upgraded.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      upgraded.close()
    }
  })
})
