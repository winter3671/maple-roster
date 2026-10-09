import { DropRepository } from '../modules/drops/drop.repository'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { HuntingRepository } from '../modules/hunting/hunting.repository'
import { HuntingService } from '../modules/hunting/hunting.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import initialSchema from '../database/migrations/001_characters.sql?raw'
import type { Character } from '../../shared/contracts/character.contract'

const query = { from: '2026-10-01', to: '2026-10-07' }

describe('사냥 회차와 거래 장부', () => {
  let database: DatabaseSync
  let characters: CharacterService
  let hunting: HuntingService
  let ledger: LedgerService
  let character: Character
  let directory: string
  let path: string

  function connect() {
    database = openDatabase(path)
    const characterRepository = new CharacterRepository(database)
    const ledgerRepository = new LedgerRepository(database)
    characters = new CharacterService(characterRepository)
    hunting = new HuntingService(
      new HuntingRepository(database),
      characterRepository,
      ledgerRepository,
      new UnitOfWork(database),
      new DropRepository(database),
      () => new Date('2026-10-07T12:00:00Z')
    )
    ledger = new LedgerService(ledgerRepository)
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-hunting-test-'))
    path = join(directory, 'data.sqlite')
    connect()
    character = characters.create({ name: '본캐', world: '스카니아' })
  })
  afterEach(() => {
    if (database.isOpen) database.close()
    const target = resolve(directory)
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith('maple-hunting-test-')
    )
      throw new Error('Unsafe test cleanup')
    rmSync(target, { recursive: true, force: true })
  })
  function input(overrides = {}) {
    return {
      characterId: character.id,
      date: '2026-10-07',
      minutes: 120,
      mesos: 150000000,
      cost: 10000000,
      solFragments: 12,
      nodestones: 5,
      notes: '첫 재획',
      requestId: randomUUID(),
      ...overrides
    }
  }

  it('회차와 거래를 함께 저장하고 재연결 후에도 유지한다', () => {
    const session = hunting.create(input())
    expect(ledger.list(query).summary).toEqual({
      income: 150000000,
      expense: 10000000,
      net: 140000000,
      count: 2
    })
    database.close()
    connect()
    expect(hunting.list(query).sessions).toEqual([session])
    expect(ledger.list(query).entries).toHaveLength(2)
  })
  it('같은 요청은 한 번만 저장하고 내용이 다른 재사용은 거부한다', () => {
    const request = input()
    expect(hunting.create(request)).toEqual(hunting.create(request))
    expect(ledger.list(query).entries).toHaveLength(2)
    expect(() => hunting.create({ ...request, mesos: 20 })).toThrow('같은 저장 요청')
    hunting.create(input())
    expect(hunting.list(query).sessions).toHaveLength(2)
  })
  it('회차 수정은 거래 ID를 유지하며 수입·비용·날짜를 함께 바꾼다', () => {
    const session = hunting.create(input())
    const originalEntries = ledger.list(query).entries
    hunting.update({ ...session, mesos: 200000000, cost: 20000000, date: '2026-10-06' })
    const updated = ledger.list(query)
    expect(updated.summary.net).toBe(180000000)
    expect(updated.entries.map((item) => item.id).sort()).toEqual(
      originalEntries.map((item) => item.id).sort()
    )
    expect(updated.entries.every((item) => item.date === '2026-10-06')).toBe(true)
    hunting.update({ ...session, cost: 0 })
    expect(ledger.list(query).entries).toHaveLength(1)
  })
  it('조회 기간과 캐릭터로 필터링하며 숨긴 캐릭터 기록도 유지한다', () => {
    hunting.create(input())
    const other = characters.create({ name: '부캐', world: '루나' })
    hunting.create(input({ characterId: other.id, date: '2026-09-30' }))
    characters.setHidden({ id: character.id, isHidden: true })
    expect(hunting.list(query).sessions).toHaveLength(1)
    expect(hunting.list({ ...query, characterId: other.id }).sessions).toHaveLength(0)
    expect(ledger.list(query).summary.net).toBe(140000000)
    expect(() => hunting.create(input())).toThrow('다시 표시')
  })
  it('이름·월드를 수정해도 이전 거래의 월드는 보존한다', () => {
    const session = hunting.create(input())
    characters.update({ ...character, name: '변경이름', world: '루나' })
    hunting.update({ ...session, notes: '메모 정정' })
    expect(hunting.list(query).sessions[0]).toMatchObject({
      characterName: '변경이름',
      characterWorld: '스카니아'
    })
    expect(ledger.list(query).entries.every((item) => item.characterWorld === '스카니아')).toBe(
      true
    )
  })
  it('수입 저장 후 비용 저장이 실패하면 회차와 모든 거래를 롤백한다', () => {
    database.exec(
      "CREATE TRIGGER reject_expense BEFORE INSERT ON ledger_entries WHEN NEW.direction = 'expense' BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => hunting.create(input())).toThrow('forced failure')
    expect(hunting.list(query).sessions).toHaveLength(0)
    expect(ledger.list(query).entries).toHaveLength(0)
  })
  it('수정 중 거래 저장 실패가 기존 회차·거래를 변경하지 않는다', () => {
    const session = hunting.create(input())
    database.exec(
      "CREATE TRIGGER reject_expense BEFORE INSERT ON ledger_entries WHEN NEW.direction = 'expense' BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => hunting.update({ ...session, mesos: 200000000 })).toThrow('forced failure')
    expect(hunting.list(query).sessions[0].mesos).toBe(150000000)
    expect(ledger.list(query).summary.income).toBe(150000000)
  })
  it('삭제 중 오류가 있으면 부모 회차와 거래 모두 남긴다', () => {
    const session = hunting.create(input())
    database.exec(
      "CREATE TRIGGER reject_delete BEFORE DELETE ON ledger_entries WHEN OLD.direction = 'expense' BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    )
    expect(() => hunting.remove(session.id)).toThrow('forced failure')
    expect(hunting.list(query).sessions).toHaveLength(1)
    expect(ledger.list(query).entries).toHaveLength(2)
  })
  it('연결 캐릭터 삭제를 막고 회차 삭제 시 거래만 함께 지운다', () => {
    const first = hunting.create(input())
    hunting.create(input())
    expect(() => characters.remove(character.id)).toThrow('숨김 기능')
    hunting.remove(first.id)
    expect(hunting.list(query).sessions).toHaveLength(1)
    expect(ledger.list(query).entries).toHaveLength(2)
    expect(characters.list()).toHaveLength(1)
  })
  it.each([
    { date: '2026-10-08' },
    { date: '2026-02-30' },
    { minutes: -1 },
    { minutes: 1.5 },
    { mesos: Number.NaN },
    { cost: -1 },
    { solFragments: -1 },
    { nodestones: 0.5 },
    { minutes: 1, mesos: Number.MAX_SAFE_INTEGER, cost: 0 }
  ])('잘못된 입력을 저장하지 않는다: %j', (overrides) => {
    expect(() => hunting.create(input(overrides))).toThrow()
    expect(hunting.list(query).sessions).toHaveLength(0)
    expect(ledger.list(query).entries).toHaveLength(0)
  })
  it('역순의 조회 기간을 거부한다', () => {
    expect(() => ledger.list({ from: '2026-10-07', to: '2026-10-01' })).toThrow('시작일')
  })
  it('기존 캐릭터 DB에 두 번째 마이그레이션을 적용한다', () => {
    const legacyPath = join(directory, 'legacy.sqlite')
    const legacy = new DatabaseSync(legacyPath)
    legacy.exec(initialSchema)
    legacy.exec(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT'
    )
    legacy
      .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
      .run(1, 'characters', '2026-10-07')
    new CharacterService(new CharacterRepository(legacy)).create({
      name: '기존캐릭터',
      world: '월드'
    })
    legacy.close()
    const upgraded = openDatabase(legacyPath)
    try {
      expect(new CharacterRepository(upgraded).list()[0].name).toBe('기존캐릭터')
      expect(upgraded.prepare('SELECT * FROM schema_migrations').all()).toHaveLength(13)
      expect(upgraded.prepare('SELECT * FROM hunting_sessions').all()).toHaveLength(0)
    } finally {
      upgraded.close()
    }
  })
})
