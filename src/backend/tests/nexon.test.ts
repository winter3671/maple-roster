import { DropRepository } from '../modules/drops/drop.repository'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readNexonKey } from '../config/nexon-key'
import { NexonClient } from '../integrations/nexon/nexon.client'
import { NexonService } from '../modules/nexon/nexon.service'
import { openDatabase } from '../database/connection'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { HuntingService } from '../modules/hunting/hunting.service'
import { HuntingRepository } from '../modules/hunting/hunting.repository'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { UnitOfWork } from '../database/unit-of-work'
import { randomUUID } from 'node:crypto'

const row = {
  ocid: 'test-ocid',
  character_name: '테스트캐릭터',
  world_name: '스카니아',
  character_class: '아크',
  character_level: 280
}
const basic = { ...row, character_guild_name: '테스트길드' }
const list = { account_list: [{ account_id: 'not-exposed', character_list: [row] }] }
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const directories: string[] = []
const closes: (() => void)[] = []
function directory() {
  const dir = mkdtempSync(join(tmpdir(), 'maple-nexon-test-'))
  directories.push(dir)
  return dir
}
afterEach(() => {
  for (const close of closes.splice(0)) close()
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('local API key configuration', () => {
  it('handles missing or empty keys without breaking offline mode', () => {
    const dir = directory()
    expect(readNexonKey(dir)).toEqual({ configured: false, issue: 'missing' })
    writeFileSync(join(dir, '.env'), 'NEXON_API_KEY=\n')
    expect(readNexonKey(dir)).toEqual({ configured: false, issue: 'missing' })
  })
  it('supports quoted values, BOM and comments without changing the environment', () => {
    const dir = directory()
    writeFileSync(
      join(dir, '.env'),
      '\uFEFFNEXON_API_KEY="fake-test-key" # comment\nMAPLE_NEXON_TEST_UNRELATED=never-applied\n'
    )
    expect(readNexonKey(dir)).toEqual({ configured: true, issue: null, key: 'fake-test-key' })
    expect(process.env.MAPLE_NEXON_TEST_UNRELATED).toBeUndefined()
  })
  it('rejects header control characters and invalid key values', () => {
    const dir = directory()
    writeFileSync(join(dir, '.env'), 'NEXON_API_KEY="키를넣으세요"')
    expect(readNexonKey(dir)).toEqual({ configured: false, issue: 'invalid' })
  })
})

describe('Nexon API boundary', () => {
  it('sends the key only in the header and exposes only selected DTO fields', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response(list))
    const client = new NexonClient(() => 'fake-test-key', transport, 0)
    expect(await client.list()).toEqual([
      {
        ocid: row.ocid,
        name: row.character_name,
        world: row.world_name,
        job: row.character_class,
        level: 280
      }
    ])
    const [url, options] = transport.mock.calls[0]
    expect(String(url)).toBe('https://open.api.nexon.com/maplestory/v1/character/list')
    expect(options?.headers).toEqual({ 'x-nxopen-api-key': 'fake-test-key' })
    expect(options?.redirect).toBe('error')
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })
  it('deduplicates OCIDs across accounts and sorts by level', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        account_list: [
          { character_list: [row, { ...row, ocid: 'other', character_level: 290 }] },
          { character_list: [row] }
        ]
      })
    )
    const result = await new NexonClient(() => 'fake', transport, 0).list()
    expect(result.map((item) => item.ocid)).toEqual(['other', 'test-ocid'])
  })
  it('maps profile fields and allows an absent guild', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ ...basic, character_guild_name: null }))
    const profile = await new NexonClient(() => 'fake', transport, 0).basic(row.ocid)
    expect(profile.guild).toBe('')
    expect(profile.level).toBe(280)
    expect(new URL(String(transport.mock.calls[0][0])).searchParams.get('ocid')).toBe(row.ocid)
  })
  it('does not call the network without a key or with an invalid OCID', async () => {
    const transport = vi.fn<typeof fetch>()
    const client = new NexonClient(() => undefined, transport, 0)
    await expect(client.list()).rejects.toMatchObject({ code: 'API_KEY_MISSING' })
    await expect(client.basic('../bad?key=x')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(transport).not.toHaveBeenCalled()
  })
  it.each([
    [400, 'OPENAPI00005', 'API_KEY_INVALID'],
    [403, 'OPENAPI00002', 'API_PERMISSION_DENIED'],
    [429, 'OPENAPI00007', 'API_RATE_LIMITED'],
    [503, 'OPENAPI00011', 'API_UNAVAILABLE'],
    [400, 'OPENAPI00009', 'API_UNAVAILABLE']
  ])('maps HTTP %s / %s without exposing response details', async (status, name, expected) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ error: { name, message: 'fake-test-key upstream diagnostic' } }, Number(status))
      )
    const client = new NexonClient(() => 'fake-test-key', transport, 0)
    const error = await client.list().catch((caught) => caught)
    expect(error.code).toBe(expected)
    expect(error.message).not.toContain('fake-test-key')
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('sanitizes network exceptions', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('fake-test-key connection details'))
    await expect(new NexonClient(() => 'fake-test-key', transport, 0).list()).rejects.toMatchObject(
      { code: 'API_NETWORK_ERROR' }
    )
  })
  it.each([
    {},
    { account_list: [null] },
    { account_list: [{ character_list: [{ ...row, character_level: '280' }] }] }
  ])('rejects malformed successful responses', async (body) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response(body))
    await expect(new NexonClient(() => 'fake', transport, 0).list()).rejects.toMatchObject({
      code: 'API_RESPONSE_INVALID'
    })
  })
  it('serializes concurrent requests and recovers after failures', async () => {
    let active = 0
    let peak = 0
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active--
      return transport.mock.calls.length === 1 ? response({}, 500) : response(list)
    })
    const client = new NexonClient(() => 'fake', transport, 0)
    const results = await Promise.allSettled([client.list(), client.list()])
    expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(peak).toBe(1)
  })
})

describe('API character registration', () => {
  function fixture(
    transport: typeof fetch = vi.fn<typeof fetch>().mockImplementation(async () => response(basic))
  ) {
    const database = openDatabase(join(directory(), 'test.sqlite'))
    closes.push(() => database.close())
    const repository = new CharacterRepository(database)
    const characters = new CharacterService(repository)
    const client = new NexonClient(() => 'fake', transport, 0)
    return {
      database,
      characters,
      service: new NexonService(
        client,
        { configured: true, issue: null },
        repository,
        characters,
        undefined,
        new UnitOfWork(database)
      )
    }
  }
  it('resolves metadata in the backend and makes repeated registration idempotent', async () => {
    const { characters, service } = fixture()
    const first = await service.register(row.ocid)
    const second = await service.register(row.ocid)
    expect(first.alreadyRegistered).toBe(false)
    expect(second.alreadyRegistered).toBe(true)
    expect(second.character.id).toBe(first.character.id)
    expect(characters.list()).toHaveLength(1)
    expect(first.character.name).toBe(row.character_name)
  })
  it('preserves an existing character ID, notes, hidden state and hunting records', async () => {
    const { database, characters, service } = fixture()
    const existing = characters.create({
      name: row.character_name,
      world: row.world_name,
      notes: '보존할 메모'
    })
    const hunting = new HuntingService(
      new HuntingRepository(database),
      new CharacterRepository(database),
      new LedgerRepository(database),
      new UnitOfWork(database),
      new DropRepository(database),
      () => new Date('2026-10-08T00:00:00Z')
    )
    const session = hunting.create({
      requestId: randomUUID(),
      characterId: existing.id,
      date: '2026-10-07',
      minutes: 60,
      mesos: 1000,
      cost: 100,
      solFragments: 1,
      nodestones: 0,
      notes: ''
    })
    characters.setHidden({ id: existing.id, isHidden: true })
    const result = await service.register(row.ocid)
    expect(result.character).toMatchObject({
      id: existing.id,
      notes: '보존할 메모',
      isHidden: true
    })
    expect(hunting.list({ from: '2026-10-07', to: '2026-10-08' }).sessions[0].id).toBe(session.id)
    expect(service.status()).toEqual({ configured: true, issue: null })
  })
  it('registers multiple distinct characters and deduplicates repeated selections', async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const ocid = new URL(String(url)).searchParams.get('ocid')!
      return response({ ...basic, character_name: ocid === 'first' ? '첫캐릭터' : '둘째캐릭터' })
    })
    const { characters, service } = fixture(transport)
    const result = await service.registerMany(['first', 'first', 'second'])
    expect(result.items.map((item) => item.status)).toEqual(['created', 'created'])
    expect(characters.list()).toHaveLength(2)
    const ids = characters.list().map((character) => character.id)
    expect(
      (await service.registerMany(['first', 'second'])).items.map((item) => item.status)
    ).toEqual(['existing', 'existing'])
    expect(characters.list().map((character) => character.id)).toEqual(ids)
    expect(transport).toHaveBeenCalledTimes(4)
  })
  it('validates the whole selection before creating any records', async () => {
    const transport = vi.fn<typeof fetch>()
    const { characters, service } = fixture(transport)
    for (const selection of [[], ['valid', '../invalid'], Array(501).fill('valid'), 'valid', null])
      await expect(service.registerMany(selection)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    expect(transport).not.toHaveBeenCalled()
    expect(characters.list()).toHaveLength(0)
  })
  it('keeps successful registrations when a single profile fails', async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const ocid = new URL(String(url)).searchParams.get('ocid')!
      return ocid === 'bad'
        ? response({})
        : response({ ...basic, character_name: ocid === 'first' ? '첫캐릭터' : '둘째캐릭터' })
    })
    const { characters, service } = fixture(transport)
    const result = await service.registerMany(['first', 'bad', 'second'])
    expect(result.items.map((item) => item.status)).toEqual(['created', 'failed', 'created'])
    expect(result.items[1]).toMatchObject({ ocid: 'bad', error: { code: 'API_RESPONSE_INVALID' } })
    expect(characters.list()).toHaveLength(2)
  })
  it('stops on shared API failure and reports the remaining selections as unattempted', async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const ocid = new URL(String(url)).searchParams.get('ocid')!
      return ocid === 'limit'
        ? response({ error: { name: 'OPENAPI00007', message: 'private diagnostic' } }, 429)
        : response(basic)
    })
    const { characters, service } = fixture(transport)
    const result = await service.registerMany(['first', 'limit', 'last'])
    expect(result.items.map((item) => item.status)).toEqual(['created', 'failed', 'notAttempted'])
    expect(result.items[2]).toMatchObject({ ocid: 'last', error: { code: 'API_RATE_LIMITED' } })
    expect(JSON.stringify(result)).not.toContain('private diagnostic')
    expect(transport).toHaveBeenCalledTimes(2)
    expect(characters.list()).toHaveLength(1)
  })
})
