import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { BossSyncService } from '../modules/bosses/boss-sync.service'
import { DropRepository } from '../modules/drops/drop.repository'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { NexonClient } from '../integrations/nexon/nexon.client'

describe('API 보스 클리어 미리보기와 반영', () => {
  let database: DatabaseSync,
    characters: CharacterRepository,
    bosses: BossService,
    sync: BossSyncService,
    ledger: LedgerService
  let now: Date,
    characterId: string,
    responseDate: string,
    contents: Record<string, unknown>[],
    transport: ReturnType<typeof vi.fn<typeof fetch>>
  const query = { date: '2026-10-15' }
  const month = { from: '2026-10-01', to: '2026-10-31' }
  beforeEach(() => {
    now = new Date('2026-10-15T00:00:00Z')
    database = openDatabase(':memory:')
    characters = new CharacterRepository(database, () => now)
    const character = new CharacterService(characters).create({
      name: 'API보스캐릭터',
      world: '루나',
      notes: ''
    })
    characterId = character.id
    characters.saveProfile(character.id, {
      ocid: 'fake-ocid',
      name: character.name,
      world: character.world,
      level: 280,
      job: '아크',
      guild: '',
      fetchedAt: now.toISOString()
    })
    const ledgerRepo = new LedgerRepository(database)
    ledger = new LedgerService(ledgerRepo)
    bosses = new BossService(
      new BossRepository(database),
      characters,
      ledgerRepo,
      new UnitOfWork(database),
      new DropRepository(database),
      () => now
    )
    responseDate = '2026-10-15T00:00+09:00'
    contents = [
      { content_name: '스우', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' }
    ]
    transport = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ date: responseDate, boss_contents: contents }))
      )
    sync = new BossSyncService(
      new NexonClient(() => 'fake-key', transport, 0),
      characters,
      bosses,
      () => now
    )
  })
  afterEach(() => database.close())
  const run = (bossName = '스우', difficulty = '노멀', date = query.date) =>
    bosses.createRun({ characterId, date, bossName, difficulty, partySize: 3 })
  const preview = (date = query.date) => sync.preview({ date, characterId })
  it('미리보기는 장부를 바꾸지 않고 완료와 난이도가 일치한 보스만 선택 가능하다', async () => {
    const sw = run(),
      damien = run('데미안'),
      will = run('윌', '하드'),
      gloom = run('더스크', '카오스')
    contents.push(
      { content_name: '데미안', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'false' },
      { content_name: '윌', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' },
      { content_name: '자쿰', difficulty: 'chaos', cycle: 'bossWeekly', complete_flag: 'true' },
      { content_name: '더스크', difficulty: 'chaos', cycle: 'bossDaily', complete_flag: 'true' }
    )
    const result = await preview()
    expect(result.rows.find((row) => row.runId === sw.id)?.state).toBe('ready')
    expect(result.rows.find((row) => row.runId === damien.id)?.state).toBe('incomplete')
    expect(result.rows.find((row) => row.runId === will.id)?.state).toBe('difficultyMismatch')
    expect(result.rows.find((row) => row.runId === gloom.id)?.state).toBe('missing')
    expect(result.unmatchedClears).toEqual([
      { bossName: '윌', difficulty: '노멀' },
      { bossName: '자쿰', difficulty: '카오스' }
    ])
    expect(ledger.list(month).entries).toEqual([])
    expect(bosses.list(query).runs.every((row) => !row.isCleared)).toBe(true)
    expect(() => sync.apply({ previewId: result.id, runIds: [damien.id] })).toThrow('완료를 확인한')
    expect(sync.apply({ previewId: result.id, runIds: [sw.id, sw.id] })).toEqual({
      applied: 1,
      alreadyCleared: 0
    })
    expect(ledger.list(month).summary.income).toBe(sw.expectedShare)
    expect(ledger.list(month).entries).toHaveLength(1)
    expect(() => sync.apply({ previewId: result.id, runIds: [sw.id] })).toThrow('만료')
  })
  it('기존 수동 클리어와 직접 입력한 금액·날짜를 API 미완료로 취소하지 않는다', async () => {
    const sw = run()
    bosses.setClear({ id: sw.id, isCleared: true })
    bosses.settle({ runId: sw.id, date: query.date, amount: 60 })
    const original = ledger.list(month).entries[0]
    contents[0].complete_flag = 'false'
    const result = await preview()
    expect(result.rows[0].state).toBe('alreadyCleared')
    expect(ledger.list(month).entries).toEqual([original])
  })
  it('조회 후 인원 변경은 모든 반영을 롤백한다', async () => {
    const sw = run(),
      damien = run('데미안')
    contents.push({
      content_name: '데미안',
      difficulty: 'normal',
      cycle: 'bossWeekly',
      complete_flag: 'true'
    })
    const result = await preview()
    bosses.updateRun({ ...damien, partySize: 2 })
    expect(() => sync.apply({ previewId: result.id, runIds: [sw.id, damien.id] })).toThrow(
      '구성이 변경'
    )
    expect(ledger.list(month).entries).toEqual([])
    expect(bosses.list(query).runs.every((row) => !row.isCleared)).toBe(true)
  })
  it('장부 저장 실패는 클리어 체크도 롤백한다', async () => {
    const sw = run(),
      result = await preview()
    database.exec(
      "CREATE TRIGGER reject_income BEFORE INSERT ON ledger_entries BEGIN SELECT RAISE(ABORT,'ledger failure'); END"
    )
    expect(() => sync.apply({ previewId: result.id, runIds: [sw.id] })).toThrow('ledger failure')
    expect(bosses.list(query).runs[0].isCleared).toBe(false)
  })
  it('미리보기 이후 수동 체크가 생기면 금액과 날짜를 보존한다', async () => {
    const sw = run(),
      result = await preview()
    bosses.setClear({ id: sw.id, isCleared: true })
    const original = ledger.list(month).entries[0]
    expect(sync.apply({ previewId: result.id, runIds: [sw.id] })).toEqual({
      applied: 0,
      alreadyCleared: 1
    })
    expect(ledger.list(month).entries).toEqual([original])
  })
  it('5분 만료와 연결 해제를 확인한다', async () => {
    const sw = run(),
      expired = await preview()
    now = new Date(now.getTime() + 5 * 60 * 1000)
    expect(() => sync.apply({ previewId: expired.id, runIds: [sw.id] })).toThrow('만료')
    const result = await preview()
    characters.unlink(characterId)
    expect(() => sync.apply({ previewId: result.id, runIds: [sw.id] })).toThrow('연결이 변경')
    expect(ledger.list(month).entries).toEqual([])
  })
  it('최근 14일 범위의 과거 주차는 마지막 날을 조회하고 수익 날짜를 조정할 수 있다', async () => {
    const sw = run('스우', '노멀', '2026-10-08')
    responseDate = '2026-10-14T00:00+09:00'
    const result = await preview('2026-10-08')
    expect(result).toMatchObject({ queriedDate: '2026-10-14', incomeDate: '2026-10-08' })
    const url = new URL(String(transport.mock.calls[0][0]))
    expect(url.searchParams.get('date')).toBe('2026-10-14')
    sync.apply({ previewId: result.id, runIds: [sw.id], incomeDate: '2026-10-13' })
    expect(ledger.list(month).entries[0].date).toBe('2026-10-13')
  })
  it('미래·조회 범위 밖·미연결·빈 주차는 API 요청 전에 차단한다', async () => {
    run()
    await expect(preview('2026-10-22')).rejects.toThrow('미래')
    await expect(preview('2026-09-24')).rejects.toThrow('최근 14일')
    await expect(preview('2026-10-08')).rejects.toThrow('먼저 생성')
    characters.unlink(characterId)
    await expect(preview()).rejects.toThrow('API 연결')
    expect(transport).not.toHaveBeenCalled()
  })
  it('API 실패·응답 날짜 불일치·잘못된 완료값은 저장 없이 오류로 처리한다', async () => {
    run()
    transport.mockResolvedValueOnce(
      new Response('{"error":{"name":"OPENAPI00005","message":"private detail"}}', { status: 401 })
    )
    await expect(preview()).rejects.toMatchObject({ code: 'API_KEY_INVALID' })
    responseDate = '2026-10-14T00:00+09:00'
    await expect(preview()).rejects.toMatchObject({ code: 'API_RESPONSE_INVALID' })
    responseDate = '2026-10-15T00:00+09:00'
    contents[0].complete_flag = 'invalid'
    await expect(preview()).rejects.toMatchObject({ code: 'API_RESPONSE_INVALID' })
    expect(ledger.list(month).entries).toEqual([])
  })
  it('현재 조회에는 날짜를 생략하고 공백 이름·영문 난이도와 대체 완료 필드를 정규화한다', async () => {
    const jh = run('진 힐라', '하드')
    contents = [
      { content_name: '진힐라', difficulty: 'hard', cycle: 'bossWeekly', clear_flag: 'true' }
    ]
    expect((await preview()).rows.find((row) => row.runId === jh.id)?.state).toBe('ready')
    const [url, options] = transport.mock.calls[0]
    expect(new URL(String(url)).searchParams.has('date')).toBe(false)
    expect(options?.headers).toEqual({ 'x-nxopen-api-key': 'fake-key' })
    contents[0].complete_flag = 'false'
    await expect(preview()).rejects.toMatchObject({ code: 'API_RESPONSE_INVALID' })
  })
})
