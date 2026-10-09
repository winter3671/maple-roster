import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { NexonClient } from '../integrations/nexon/nexon.client'
import { NexonService } from '../modules/nexon/nexon.service'

describe('캐릭터 OCID 연결과 프로필 갱신', () => {
  let database: DatabaseSync,
    repository: CharacterRepository,
    characters: CharacterService,
    service: NexonService
  let current: Date, transport: ReturnType<typeof vi.fn<typeof fetch>>
  let profile: {
    character_name: string
    world_name: string
    character_class: string
    character_level: number
    character_guild_name: string | null
    character_image?: string | null
  }
  beforeEach(() => {
    current = new Date('2026-10-08T00:00:00Z')
    profile = {
      character_name: '연동캐릭터',
      world_name: '루나',
      character_class: '아크',
      character_level: 280,
      character_guild_name: '검증길드',
      character_image:
        'https://open.api.nexon.com/static/maplestory/character/look/' +
        'A'.repeat(2048) +
        '?wmotion=W00'
    }
    database = openDatabase(':memory:')
    repository = new CharacterRepository(database, () => current)
    characters = new CharacterService(repository)
    transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(profile)))
    service = new NexonService(
      new NexonClient(() => 'fake-key', transport, 0),
      { configured: true, issue: null },
      repository,
      characters,
      undefined,
      new UnitOfWork(database),
      () => current
    )
  })
  afterEach(() => database.close())
  it('캐릭터 이미지를 등록·갱신하며 API 연결 해제 시 제거한다', async () => {
    const first = await service.register('first-ocid')
    expect(first.character.nexon?.profile?.imageUrl).toBe(profile.character_image)
    profile.character_image =
      'https://open.api.nexon.com/static/maplestory/character/look/new-avatar'
    await service.syncProfiles({ force: true })
    expect(repository.find(first.character.id)?.nexon?.profile?.imageUrl).toBe(
      profile.character_image
    )
    repository.unlink(first.character.id)
    expect(
      database.prepare('SELECT nexon_image_url FROM characters WHERE id=?').get(first.character.id)
        ?.nexon_image_url
    ).toBeNull()
  })
  it('이미지 URL이 없거나 허용되지 않아도 프로필 조회는 성공하고 기본 아이콘을 사용한다', async () => {
    profile.character_image = 'https://example.com/avatar.png'
    const first = await service.register('first-ocid')
    expect(first.character.nexon?.profile?.imageUrl).toBeNull()
    delete profile.character_image
    await service.syncProfiles({ force: true })
    expect(repository.find(first.character.id)?.nexon?.profile?.imageUrl).toBeNull()
  })
  it('기존 캐릭터를 연결하고 ID·메모·숨김을 유지하며 프로필을 DB에 저장한다', async () => {
    const manual = characters.create({
      name: profile.character_name,
      world: profile.world_name,
      notes: '내 메모'
    })
    characters.setHidden({ id: manual.id, isHidden: true })
    const result = await service.register('first-ocid')
    expect(result.alreadyRegistered).toBe(true)
    expect(result.character).toMatchObject({
      id: manual.id,
      notes: '내 메모',
      isHidden: true,
      nexon: {
        ocid: 'first-ocid',
        profile: { level: 280, job: '아크', guild: '검증길드', fetchedAt: current.toISOString() }
      }
    })
    expect(new CharacterRepository(database, () => current).find(manual.id)?.nexon).toEqual(
      result.character.nexon
    )
  })
  it('OCID로 이름·월드가 바뀐 캐릭터를 갱신하고 재등록해도 중복을 만들지 않는다', async () => {
    const first = await service.register('first-ocid')
    characters.update({ ...first.character, notes: '유지할 메모' })
    profile = {
      ...profile,
      character_name: '새이름',
      world_name: '스카니아',
      character_level: 285,
      character_guild_name: null
    }
    const result = await service.syncProfiles({ force: true, characterIds: [first.character.id] })
    expect(result.items).toEqual([{ characterId: first.character.id, status: 'updated' }])
    expect(repository.find(first.character.id)).toMatchObject({
      name: '새이름',
      world: '스카니아',
      notes: '유지할 메모',
      nexon: { profile: { level: 285, guild: '' } }
    })
    expect((await service.register('first-ocid')).character.id).toBe(first.character.id)
    expect(characters.list()).toHaveLength(1)
  })
  it('이름·월드 충돌 및 다른 OCID 연결은 기존 프로필을 보존한다', async () => {
    const first = await service.register('first-ocid')
    await expect(service.register('other-ocid')).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' })
    characters.create({ name: '충돌캐릭터', world: '루나', notes: '' })
    profile = { ...profile, character_name: '충돌캐릭터', character_level: 290 }
    const result = await service.syncProfiles({ force: true })
    expect(result.items[0]).toMatchObject({
      status: 'failed',
      error: { code: 'DUPLICATE_CHARACTER' }
    })
    expect(repository.find(first.character.id)).toEqual(first.character)
  })
  it('자동 갱신은 하루 이상 지난 표시 캐릭터에만 요청하고 반복 호출을 제한한다', async () => {
    const first = await service.register('first-ocid')
    profile = { ...profile, character_name: '숨김캐릭터' }
    const hidden = await service.register('hidden-ocid')
    characters.setHidden({ id: hidden.character.id, isHidden: true })
    expect((await service.syncProfiles({ force: false })).items).toEqual([])
    current = new Date(current.getTime() + 25 * 60 * 60 * 1000)
    profile = { ...profile, character_name: '연동캐릭터', character_level: 281 }
    expect((await service.syncProfiles({ force: false })).items).toEqual([
      { characterId: first.character.id, status: 'updated' }
    ])
    expect((await service.syncProfiles({ force: false })).items).toEqual([])
    expect(transport).toHaveBeenCalledTimes(3)
  })
  it('공통 API 실패는 남은 요청을 중단하고 기존 프로필을 보존한다', async () => {
    const first = await service.register('first-ocid')
    profile = { ...profile, character_name: '두번째' }
    const second = await service.register('second-ocid')
    transport.mockResolvedValue(
      new Response(JSON.stringify({ error: { name: 'OPENAPI00005', message: 'private detail' } }), {
        status: 401
      })
    )
    const result = await service.syncProfiles({
      force: true,
      characterIds: [first.character.id, second.character.id]
    })
    expect(result.items.map((row) => row.status)).toEqual(['failed', 'notAttempted'])
    expect(JSON.stringify(result)).not.toContain('private detail')
    expect(transport).toHaveBeenCalledTimes(3)
    expect(repository.find(first.character.id)).toEqual(first.character)
    expect(repository.find(second.character.id)).toEqual(second.character)
  })
  it('연결 해제는 API 캐시만 지우고 다시 연결할 수 있다', async () => {
    const first = await service.register('first-ocid')
    characters.update({ ...first.character, notes: '내 장부 캐릭터' })
    const unlinked = service.unlink(first.character.id)
    expect(unlinked.nexon).toBeUndefined()
    expect(unlinked).toMatchObject({
      id: first.character.id,
      name: first.character.name,
      notes: '내 장부 캐릭터'
    })
    expect((await service.register('first-ocid')).character.id).toBe(first.character.id)
  })
  it('30일 지난 프로필 캐시는 지우고 연결 식별자와 수동 기록은 유지한다', async () => {
    const first = await service.register('first-ocid')
    current = new Date(current.getTime() + 30 * 24 * 60 * 60 * 1000)
    expect(repository.find(first.character.id)?.nexon).toEqual({
      ocid: 'first-ocid',
      profile: null
    })
    expect(
      database
        .prepare(
          'SELECT nexon_level,nexon_job,nexon_guild,nexon_fetched_at,nexon_image_url FROM characters'
        )
        .get()
    ).toEqual({
      nexon_level: null,
      nexon_job: null,
      nexon_guild: null,
      nexon_fetched_at: null,
      nexon_image_url: null
    })
    expect((await service.syncProfiles({ force: false })).items[0].status).toBe('updated')
    expect(repository.find(first.character.id)?.nexon?.profile?.level).toBe(280)
  })
  it('새 캐릭터 프로필 저장 실패는 캐릭터 생성도 롤백한다', async () => {
    database.exec(
      "CREATE TRIGGER reject_profile BEFORE UPDATE OF nexon_ocid ON characters BEGIN SELECT RAISE(ABORT,'profile failure'); END"
    )
    await expect(service.register('first-ocid')).rejects.toThrow('profile failure')
    expect(characters.list()).toEqual([])
  })
  it('전체 선택을 사전 검증하고 조회 중 연결 해제한 캐릭터에 재연결하지 않는다', async () => {
    const first = await service.register('first-ocid')
    const manual = characters.create({ name: '수동캐릭터', world: '루나', notes: '' })
    await expect(
      service.syncProfiles({ force: true, characterIds: [first.character.id, manual.id] })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(transport).toHaveBeenCalledTimes(1)
    let resolveResponse!: (value: Response) => void
    let started!: () => void
    const starting = new Promise<void>((resolve) => {
      started = resolve
    })
    transport.mockImplementation(() => {
      started()
      return new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
    })
    const pending = service.syncProfiles({ force: true })
    await starting
    service.unlink(first.character.id)
    resolveResponse(new Response(JSON.stringify(profile)))
    expect((await pending).items[0]).toMatchObject({
      status: 'failed',
      error: { code: 'REQUEST_CONFLICT' }
    })
    expect(repository.find(first.character.id)?.nexon).toBeUndefined()
  })
})
