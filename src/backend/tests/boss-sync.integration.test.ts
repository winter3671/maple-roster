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
import { WEEKLY_BOSSES } from '../../shared/boss-catalog'

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
  it('월간 API는 주간 응답을 제외하고 1인으로 추가하며 반복 조회와 인원 수정을 보존한다', async () => {
    contents.push({
      content_name: '검은 마법사',
      difficulty: 'hard',
      cycle: 'bossMonthly',
      complete_flag: 'true'
    })
    await sync.syncAll(query)
    const weekly = bosses.list(query).runs[0]
    const monthlyQuery = { date: query.date, cycle: 'monthly' as const }
    expect((await sync.syncAll(monthlyQuery)).items[0]).toMatchObject({
      status: 'synced',
      added: 1
    })
    let row = bosses.list(monthlyQuery).runs[0]
    expect(row).toMatchObject({
      week: '2026-10-01',
      partySize: 1,
      isCleared: true,
      cycle: 'monthly'
    })
    row = bosses.updateRun({ ...row, partySize: 6, notes: '6인 파티' })
    await sync.syncAll(monthlyQuery)
    expect(bosses.list(monthlyQuery).runs[0]).toMatchObject({
      id: row.id,
      partySize: 6,
      notes: '6인 파티'
    })
    expect(bosses.list(query).runs).toEqual([weekly])
    expect(ledger.list(month).entries).toHaveLength(2)
    contents[1].complete_flag = 'false'
    await sync.syncAll(monthlyQuery)
    expect(bosses.list(monthlyQuery).runs[0].isCleared).toBe(true)
  })
  it('월간 기록은 달이 바뀌면 새 기록을 만들고 이전 달 조회는 최근 14일까지만 허용한다', async () => {
    contents = [
      {
        content_name: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'bossMonthly',
        complete_flag: 'true'
      }
    ]
    await sync.syncAll({ date: query.date, cycle: 'monthly' })
    const old = bosses.list({ date: query.date, cycle: 'monthly' }).runs[0]
    now = new Date('2026-11-01T00:00:00Z')
    responseDate = '2026-11-01T00:00+09:00'
    await sync.syncAll({ date: '2026-11-01', cycle: 'monthly', characterId })
    expect(bosses.list({ date: '2026-11-01', cycle: 'monthly' }).runs[0].id).not.toBe(old.id)
    expect(bosses.list({ date: query.date, cycle: 'monthly' }).runs[0]).toEqual(old)
    now = new Date('2026-11-15T00:00:00Z')
    await expect(sync.syncAll({ date: '2026-10-01', cycle: 'monthly' })).rejects.toThrow('14일')
  })
  it('자동 추가는 1인으로 등록하고 반복 조회·메모 수정에 확인 체크나 중복 수익이 필요 없다', async () => {
    const first = await sync.syncAll(query)
    expect(first.items[0].added).toBe(1)
    let row = bosses.list(query).runs[0]
    expect(row).toMatchObject({ partySize: 1, partySizeNeedsReview: false, isCleared: true })
    const original = ledger.list(month).entries
    const repeated = await sync.syncAll(query)
    expect(repeated.items[0].added).toBe(0)
    row = bosses.updateRun({ ...row, notes: '인원 확인 전 메모' })
    expect(row.partySizeNeedsReview).toBe(false)
    expect(() => bosses.updateRun({ ...row, confirmPartySize: 'true' })).toThrow('인원 확인')
    row = bosses.updateRun({ ...row, confirmPartySize: true })
    expect(row.partySizeNeedsReview).toBe(false)
    expect(ledger.list(month).entries).toEqual(original)
    await sync.syncAll(query)
    expect(bosses.list(query).runs[0].partySizeNeedsReview).toBe(false)
  })
  it('다인 파티로 인원을 수정하면 장부 금액을 갱신하고 재조회에도 유지한다', async () => {
    await sync.syncAll(query)
    const row = bosses.list(query).runs[0]
    expect(() => bosses.updateRun({ ...row, partySize: 7, confirmPartySize: true })).toThrow(
      '파티 인원'
    )
    expect(bosses.list(query).runs[0].partySizeNeedsReview).toBe(false)
    const updated = bosses.updateRun({ ...row, partySize: 2 })
    expect(updated).toMatchObject({ partySizeNeedsReview: false, partySize: 2 })
    expect(updated.settlement?.amount).toBe(4175000)
    expect(ledger.list(month).summary.income).toBe(4175000)
    await sync.syncAll(query)
    expect(bosses.list(query).runs[0]).toMatchObject({ partySize: 2, partySizeNeedsReview: false })
  })
  it('기존 인원을 유지하고 자동 난이도 변경도 개별 확인 상태를 만들지 않는다', async () => {
    run()
    await sync.syncAll(query)
    expect(bosses.list(query).runs[0]).toMatchObject({ partySize: 3, partySizeNeedsReview: false })
    contents[0].content_name = '데미안'
    run('데미안')
    contents[0].difficulty = 'hard'
    await sync.syncAll(query)
    expect(bosses.list(query).runs.find((row) => row.bossName === '데미안')).toMatchObject({
      partySizeNeedsReview: false,
      difficulty: '하드'
    })
  })
  const run = (bossName = '스우', difficulty = '노멀', date = query.date) =>
    bosses.createRun({ characterId, date, bossName, difficulty, partySize: 3 })
  const preview = (date = query.date) => sync.preview({ date, characterId })
  const replace = (result: Awaited<ReturnType<typeof preview>>) =>
    sync.apply({
      previewId: result.id,
      mode: 'replace',
      members: result.replacement.members.map(({ bossName, difficulty, partySize }) => ({
        bossName,
        difficulty,
        partySize
      })),
      incomeDate: result.incomeDate
    })
  const linkedCharacter = (name: string, ocid?: string) => {
    const character = new CharacterService(characters).create({ name, world: '루나', notes: '' })
    characters.saveProfile(character.id, {
      ocid: ocid ?? `fake-${character.id}`,
      name,
      world: character.world,
      level: 280,
      job: '아크',
      guild: '',
      fetchedAt: now.toISOString()
    })
    database
      .prepare('UPDATE characters SET created_at=? WHERE id=?')
      .run(
        new Date(Date.parse(characters.find(characterId)!.createdAt) + 1000).toISOString(),
        character.id
      )
    return character
  }
  it('빈 주차의 등록 캐릭터만 일괄 조회하고 새 보스를 1인으로 등록하며 반복 수익을 만들지 않는다', async () => {
    const second = linkedCharacter('두번째')
    const unlinked = new CharacterService(characters).create({
      name: '수동캐릭터',
      world: '루나',
      notes: ''
    })
    bosses.createPreset({ characterId, bossName: '스우', difficulty: '노멀', partySize: 3 })
    const first = await sync.syncAll(query)
    expect(first.items.filter((item) => item.status === 'synced')).toHaveLength(2)
    expect(first.items.find((item) => item.characterId === unlinked.id)?.status).toBe('unlinked')
    expect(transport).toHaveBeenCalledTimes(2)
    expect(
      transport.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('ocid')).sort()
    ).toEqual(['fake-ocid', characters.find(second.id)!.nexon!.ocid].sort())
    expect(bosses.list(query).runs).toHaveLength(2)
    expect(bosses.list(query).runs.every((row) => row.partySize === 1 && row.isCleared)).toBe(true)
    expect(bosses.list(query).runs.some((row) => row.characterId === second.id)).toBe(true)
    expect(bosses.presets(characterId)[0].partySize).toBe(3)
    const entries = ledger.list(month).entries
    const again = await sync.syncAll(query)
    expect(
      again.items
        .filter((item) => item.status === 'synced')
        .every((item) => item.applied === 0 && item.alreadyCleared === 1)
    ).toBe(true)
    expect(ledger.list(month).entries).toEqual(entries)
  })
  it('기존 인원·수동 수익과 API 밖의 수동 클리어·메모·예정 보스를 보존한다', async () => {
    const sw = run(),
      damien = run('데미안'),
      lucid = run('루시드', '노멀'),
      will = run('윌', '이지')
    bosses.setClear({ id: damien.id, isCleared: true })
    bosses.settle({ runId: damien.id, date: query.date, amount: 60 })
    bosses.updateRun({ ...lucid, notes: '수동 메모' })
    const original = ledger.list(month).entries[0]
    const result = await sync.syncAll(query)
    expect(result.items[0]).toMatchObject({ status: 'synced', applied: 1, removed: 0 })
    expect(bosses.list(query).runs.find((row) => row.id === sw.id)).toMatchObject({
      partySize: 3,
      isCleared: true
    })
    expect(bosses.list(query).runs.find((row) => row.id === will.id)?.isCleared).toBe(false)
    expect(bosses.list(query).runs.find((row) => row.id === lucid.id)?.notes).toBe('수동 메모')
    expect(ledger.list(month).entries).toContainEqual(original)
    const updated = bosses.list(query).runs.find((row) => row.id === sw.id)!
    bosses.updateRun({ ...updated, partySize: 2 })
    await sync.syncAll(query)
    expect(bosses.list(query).runs.find((row) => row.id === sw.id)?.partySize).toBe(2)
    contents[0].complete_flag = 'false'
    const entries = ledger.list(month).entries
    await sync.syncAll(query)
    expect(ledger.list(month).entries).toEqual(entries)
  })
  it('일괄 확인도 루시드가 빠진 12개 구성을 실제 12개로 맞춘다', async () => {
    const initial = WEEKLY_BOSSES.filter((boss) => boss.name !== '루시드')
      .slice(0, 12)
      .map((boss) => run(boss.name, boss.difficulties[0]))
    contents = [
      ...initial.slice(1).map((row) => ({
        content_name: row.bossName,
        difficulty: row.difficulty,
        cycle: 'bossWeekly',
        complete_flag: 'true'
      })),
      { content_name: '루시드', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' }
    ]
    const result = await sync.syncAll(query)
    expect(result.items[0]).toMatchObject({ status: 'synced', applied: 12, added: 1, removed: 1 })
    expect(bosses.list(query).runs).toHaveLength(12)
    expect(bosses.list(query).runs.find((row) => row.bossName === '루시드')).toMatchObject({
      isCleared: true,
      partySize: 1
    })
    expect(bosses.list(query).runs.some((row) => row.id === initial[0].id)).toBe(false)
  })
  it('목요일 00시(KST) 전후 주차를 분리하고 지난주 클리어와 수익을 유지한다', async () => {
    now = new Date('2026-10-14T14:59:59Z')
    responseDate = '2026-10-14'
    await sync.syncAll({ date: '2026-10-14' })
    const lastWeek = bosses.list({ date: '2026-10-14' }).runs
    const previousIncome = ledger.list(month).entries
    expect(lastWeek[0].week).toBe('2026-10-08')
    now = new Date('2026-10-14T15:00:00Z')
    responseDate = '2026-10-15'
    contents = []
    await sync.syncAll(query)
    expect(bosses.list(query).runs).toEqual([])
    contents = [
      { content_name: '스우', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' }
    ]
    await sync.syncAll(query)
    expect(bosses.list(query).runs[0]).toMatchObject({
      week: '2026-10-15',
      isCleared: true,
      settlement: { date: '2026-10-15' }
    })
    expect(bosses.list({ date: '2026-10-14' }).runs).toEqual(lastWeek)
    expect(ledger.list(month).entries).toEqual(expect.arrayContaining(previousIncome))
  })
  it('개별 API 오류는 기존 기록을 지키고 다음 캐릭터를 계속 확인한다', async () => {
    linkedCharacter('계속확인')
    const sw = run()
    transport.mockResolvedValueOnce(
      new Response('{"error":{"name":"OPENAPI00003"}}', { status: 400 })
    )
    const result = await sync.syncAll(query)
    expect(result.items.map((item) => item.status)).toEqual(['failed', 'synced'])
    expect(bosses.list(query).runs.find((row) => row.id === sw.id)?.isCleared).toBe(false)
    expect(ledger.list(month).entries).toHaveLength(1)
  })
  it('호출 제한이면 이후 캐릭터는 미처리로 표시하고 다시 시도할 수 있다', async () => {
    linkedCharacter('미처리')
    transport.mockResolvedValueOnce(
      new Response('{"error":{"name":"OPENAPI00007"}}', { status: 429 })
    )
    const result = await sync.syncAll(query)
    expect(result.items.map((item) => item.status)).toEqual(['failed', 'notAttempted'])
    expect(transport).toHaveBeenCalledTimes(1)
    expect(bosses.list(query).runs).toEqual([])
    // A new client avoids the real API client's required 5-second rate-limit backoff in this test.
    sync = new BossSyncService(
      new NexonClient(() => 'fake-key', transport, 0),
      characters,
      bosses,
      () => now
    )
    expect((await sync.syncAll(query)).items.every((item) => item.status === 'synced')).toBe(true)
  })
  it('조회 중 기록 변경과 연결 해제는 덮어쓰지 않으며 중복 일괄 요청을 막는다', async () => {
    const sw = run()
    let release!: (response: Response) => void
    transport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const pending = sync.syncAll(query)
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1))
    await expect(sync.syncAll(query)).rejects.toThrow('진행 중')
    bosses.updateRun({ ...sw, partySize: 2 })
    release(new Response(JSON.stringify({ date: responseDate, boss_contents: contents })))
    expect((await pending).items[0]).toMatchObject({
      status: 'failed',
      error: { code: 'REQUEST_CONFLICT' }
    })
    expect(bosses.list(query).runs[0]).toMatchObject({ partySize: 2, isCleared: false })
    transport.mockImplementationOnce(async () => {
      characters.unlink(characterId)
      return new Response(JSON.stringify({ date: responseDate, boss_contents: contents }))
    })
    expect((await sync.syncAll(query)).items[0]).toMatchObject({
      status: 'failed',
      error: { code: 'REQUEST_CONFLICT' }
    })
    expect(ledger.list(month).entries).toEqual([])
  })
  it('저장 오류나 보호된 난이도 충돌은 캐릭터 단위로 클리어·수익을 롤백한다', async () => {
    const sw = run()
    contents.push({
      content_name: '루시드',
      difficulty: 'normal',
      cycle: 'bossWeekly',
      complete_flag: 'true'
    })
    database.exec(
      "CREATE TRIGGER reject_batch_income BEFORE INSERT ON ledger_entries BEGIN SELECT RAISE(ABORT,'private failure'); END"
    )
    expect((await sync.syncAll(query)).items[0]).toMatchObject({
      status: 'failed',
      error: { code: 'DATABASE_ERROR' }
    })
    expect(bosses.list(query).runs).toEqual([sw])
    expect(ledger.list(month).entries).toEqual([])
    database.exec('DROP TRIGGER reject_batch_income')
    bosses.setClear({ id: sw.id, isCleared: true })
    contents[0].difficulty = 'extreme'
    expect((await sync.syncAll(query)).items[0]).toMatchObject({
      status: 'failed',
      error: { code: 'REQUEST_CONFLICT' }
    })
    expect(bosses.list(query).runs).toHaveLength(1)
  })
  it('자동 조회는 범위 밖과 미래를 차단하며 과거 수익은 주차 시작일로 기록한다', async () => {
    await expect(sync.syncAll({ date: '2026-10-22' })).rejects.toThrow('미래')
    await expect(sync.syncAll({ date: '2026-09-24' })).rejects.toThrow('최근 14일')
    expect(transport).not.toHaveBeenCalled()
    responseDate = '2026-10-14'
    const result = await sync.syncAll({ date: '2026-10-08' })
    expect(result).toMatchObject({
      week: '2026-10-08',
      queriedDate: '2026-10-14',
      incomeDate: '2026-10-08'
    })
    expect(new URL(String(transport.mock.calls[0][0])).searchParams.get('date')).toBe('2026-10-14')
    expect(bosses.list({ date: '2026-10-08' }).runs[0].settlement?.date).toBe('2026-10-08')
  })
  it('확인 도중 목요일 00시가 지나면 이전 주차에 새 클리어를 저장하지 않는다', async () => {
    now = new Date('2026-10-14T14:59:59Z')
    transport.mockImplementationOnce(async () => {
      now = new Date('2026-10-14T15:00:00Z')
      return new Response(JSON.stringify({ date: '2026-10-14', boss_contents: contents }))
    })
    const result = await sync.syncAll({ date: '2026-10-14' })
    expect(result.items[0]).toMatchObject({ status: 'failed', error: { code: 'REQUEST_CONFLICT' } })
    expect(ledger.list(month).entries).toEqual([])
  })
  it('자동 등록도 미지원·중복·13개 완료와 보존 기록으로 인한 12개 초과를 저장하지 않는다', async () => {
    contents = [
      {
        content_name: '미지원 보스',
        difficulty: 'normal',
        cycle: 'bossWeekly',
        complete_flag: 'true'
      }
    ]
    expect((await sync.syncAll(query)).items[0].status).toBe('failed')
    contents = WEEKLY_BOSSES.slice(0, 13).map((boss) => ({
      content_name: boss.name,
      difficulty: boss.difficulties[0],
      cycle: 'bossWeekly',
      complete_flag: 'true'
    }))
    expect((await sync.syncAll(query)).items[0].status).toBe('failed')
    contents = [
      { content_name: '스우', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' },
      { content_name: '스우', difficulty: 'hard', cycle: 'bossWeekly', complete_flag: 'true' }
    ]
    expect((await sync.syncAll(query)).items[0].status).toBe('failed')
    const manual = run('진 힐라', '하드')
    bosses.updateRun({ ...manual, notes: '보존할 수동 메모' })
    contents = WEEKLY_BOSSES.filter((boss) => boss.name !== '진 힐라')
      .slice(0, 12)
      .map((boss) => ({
        content_name: boss.name,
        difficulty: boss.difficulties[0],
        cycle: 'bossWeekly',
        complete_flag: 'true'
      }))
    const result = await sync.syncAll(query)
    expect(result.items[0]).toMatchObject({ status: 'failed', error: { code: 'REQUEST_CONFLICT' } })
    expect(bosses.list(query).runs).toHaveLength(1)
    expect(bosses.list(query).runs[0].notes).toBe('보존할 수동 메모')
    expect(ledger.list(month).entries).toEqual([])
  })
  it('루시드가 빠진 12개 구성을 실제 완료한 12개로 맞추고 기존 11개 기록과 수익을 유지한다', async () => {
    const initial = WEEKLY_BOSSES.filter((boss) => boss.name !== '루시드')
      .slice(0, 12)
      .map((boss) => run(boss.name, boss.difficulties[0]))
    const removed = initial[0],
      retained = initial.slice(1)
    bosses.createPreset({
      characterId,
      bossName: removed.bossName,
      difficulty: removed.difficulty,
      partySize: 1
    })
    for (const row of retained) bosses.setClear({ id: row.id, isCleared: true })
    bosses.settle({ runId: retained[0].id, date: query.date, amount: 60 })
    const originalEntries = ledger.list(month).entries
    contents = [
      ...retained.map((row) => ({
        content_name: row.bossName,
        difficulty: row.difficulty,
        cycle: 'bossWeekly',
        complete_flag: 'true'
      })),
      { content_name: '루시드', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' }
    ]
    const result = await preview()
    expect(result.replacement.blockedReasons).toEqual([])
    expect(result.replacement.removed).toEqual([
      { bossName: removed.bossName, difficulty: removed.difficulty }
    ])
    expect(result.replacement.members.find((row) => row.bossName === '루시드')?.partySize).toBe(1)
    const members = result.replacement.members.map(({ bossName, difficulty, partySize }) => ({
      bossName,
      difficulty,
      partySize: bossName === '루시드' ? 2 : partySize
    }))
    expect(sync.apply({ previewId: result.id, mode: 'replace', members })).toEqual({
      applied: 1,
      alreadyCleared: 11,
      added: 1,
      removed: 1
    })
    const final = bosses.list(query).runs
    expect(final).toHaveLength(12)
    expect(final.every((row) => row.isCleared)).toBe(true)
    expect(final.some((row) => row.id === removed.id)).toBe(false)
    expect(final.find((row) => row.bossName === '루시드')).toMatchObject({
      difficulty: '노멀',
      partySize: 2,
      expectedShare: 8900000
    })
    for (const row of retained) expect(final.some((record) => record.id === row.id)).toBe(true)
    for (const entry of originalEntries) expect(ledger.list(month).entries).toContainEqual(entry)
    expect(bosses.presets()[0].bossName).toBe(removed.bossName)
  })
  it('미클리어 보스의 난이도를 API 완료 난이도로 맞추고 인원을 반영한다', async () => {
    const sw = run()
    bosses.updateRun({ ...sw, notes: '유지할 메모' })
    contents[0].difficulty = 'extreme'
    const result = await preview()
    expect(result.replacement.members[0].partySize).toBe(2)
    expect(replace(result)).toEqual({ applied: 1, alreadyCleared: 0, added: 0, removed: 0 })
    expect(bosses.list(query).runs[0]).toMatchObject({
      id: sw.id,
      difficulty: '익스트림',
      partySize: 2,
      notes: '유지할 메모',
      isCleared: true,
      expectedShare: 272500000
    })
  })
  it('기존 수동 수익이 있는 제외 보스는 교체를 차단한다', async () => {
    const sw = run(),
      damien = run('데미안')
    bosses.setClear({ id: damien.id, isCleared: true })
    const original = ledger.list(month).entries
    const result = await preview()
    expect(result.replacement.blockedReasons.join('')).toContain('데미안')
    expect(() => replace(result)).toThrow('기존 클리어 수익')
    expect(bosses.list(query).runs).toHaveLength(2)
    expect(bosses.list(query).runs.find((row) => row.id === sw.id)?.isCleared).toBe(false)
    expect(ledger.list(month).entries).toEqual(original)
  })
  it('교체 중 수익 저장 실패는 제외·추가·난이도 변경을 모두 롤백한다', async () => {
    const sw = run(),
      damien = run('데미안')
    contents = [
      { content_name: '루시드', difficulty: 'normal', cycle: 'bossWeekly', complete_flag: 'true' }
    ]
    const result = await preview()
    database.exec(
      "CREATE TRIGGER reject_replacement BEFORE INSERT ON ledger_entries BEGIN SELECT RAISE(ABORT,'replacement failure'); END"
    )
    expect(() => replace(result)).toThrow('replacement failure')
    expect(
      bosses
        .list(query)
        .runs.map((row) => row.id)
        .sort()
    ).toEqual([sw.id, damien.id].sort())
    expect(ledger.list(month).entries).toEqual([])
  })
  it('조회 후 다른 기록을 추가하거나 인원을 바꾸면 교체를 차단한다', async () => {
    const sw = run(),
      result = await preview()
    bosses.updateRun({ ...sw, partySize: 2 })
    expect(() => replace(result)).toThrow('주차 기록이 변경')
    const next = await preview()
    run('데미안')
    expect(() => replace(next)).toThrow('주차 기록이 변경')
  })
  it('완료 목록이 없거나 12개를 초과하거나 지원하지 않는 보스이면 교체를 막는다', async () => {
    run()
    contents = []
    expect((await preview()).replacement.blockedReasons.join('')).toContain(
      'API 완료 보스가 없습니다'
    )
    contents = WEEKLY_BOSSES.slice(0, 13).map((boss) => ({
      content_name: boss.name,
      difficulty: boss.difficulties[0],
      cycle: 'bossWeekly',
      complete_flag: 'true'
    }))
    expect((await preview()).replacement.blockedReasons.join('')).toContain('12개를 초과')
    contents = [
      {
        content_name: '미지원 보스',
        difficulty: 'hard',
        cycle: 'bossWeekly',
        complete_flag: 'true'
      }
    ]
    expect((await preview()).replacement.blockedReasons.join('')).toContain('지원하지 않는')
  })
  it('교체 요청으로 API에 없는 보스와 초과 인원을 주입할 수 없다', async () => {
    run()
    const result = await preview()
    expect(() =>
      sync.apply({
        previewId: result.id,
        mode: 'replace',
        members: [{ bossName: '루시드', difficulty: '노멀', partySize: 1 }]
      })
    ).toThrow('완료를 확인한')
    expect(() =>
      sync.apply({
        previewId: result.id,
        mode: 'replace',
        members: [{ bossName: '스우', difficulty: '노멀', partySize: 7 }]
      })
    ).toThrow('파티 인원')
    expect(ledger.list(month).entries).toEqual([])
  })
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
