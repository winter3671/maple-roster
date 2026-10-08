import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../database/connection'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'

describe('캐릭터 로컬 저장', () => {
  let directory: string
  let path: string
  let database: DatabaseSync
  let service: CharacterService

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-roster-test-'))
    path = join(directory, 'data', 'test.sqlite')
    database = openDatabase(path)
    service = new CharacterService(new CharacterRepository(database))
  })

  afterEach(() => {
    if (database.isOpen) database.close()
    const target = resolve(directory)
    // 이 테스트가 만든 임시 디렉터리만 정리한다.
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith('maple-roster-test-')
    ) {
      throw new Error('테스트 정리 경로를 확인할 수 없습니다.')
    }
    rmSync(target, { recursive: true, force: true })
  })

  it('다시 연결해도 캐릭터와 메모가 유지되고 마이그레이션이 중복 적용되지 않는다', () => {
    const created = service.create({ name: '메이플기록', world: '스카니아', notes: '본캐' })
    database.close()
    database = openDatabase(path)
    service = new CharacterService(new CharacterRepository(database))
    expect(service.list()).toEqual([created])
    expect(database.prepare('SELECT * FROM schema_migrations').all()).toHaveLength(3)
  })

  it('앞뒤 공백과 Unicode 표현을 정규화한다', () => {
    const created = service.create({
      name: '  가 '.normalize('NFD'),
      world: ' 스카니아 ',
      notes: ' 메모 '
    })
    expect(created).toMatchObject({ name: '가', world: '스카니아', notes: '메모' })
    expect(() => service.create({ name: '가', world: '스카니아' })).toThrow('이미 등록')
  })

  it('대소문자만 다른 중복 등록을 막으며 다른 월드는 구분한다', () => {
    service.create({ name: 'Maple', world: '스카니아' })
    expect(() => service.create({ name: 'maple', world: '스카니아' })).toThrow('이미 등록')
    service.create({ name: 'Maple', world: '루나' })
    expect(service.list()).toHaveLength(2)
  })

  it.each([
    null,
    [],
    { name: '', world: '월드' },
    { name: '이름', world: ' ' },
    { name: 123, world: '월드' },
    { name: '줄\n바꿈', world: '월드' },
    { name: '가'.repeat(41), world: '월드' },
    { name: '이름', world: '월드', notes: '가'.repeat(501) }
  ])('잘못된 IPC 입력을 저장하지 않는다: %j', (input) => {
    expect(() => service.create(input)).toThrow()
    expect(service.list()).toHaveLength(0)
  })

  it('수정과 숨김 후에도 내부 ID와 생성 시각을 유지한다', () => {
    const original = service.create({ name: '원래이름', world: '월드', notes: '' })
    service.setHidden({ id: original.id, isHidden: true })
    const updated = service.update({
      id: original.id,
      name: '새이름',
      world: '새월드',
      notes: '수정'
    })
    expect(updated).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      isHidden: true,
      name: '새이름',
      world: '새월드',
      notes: '수정'
    })
    service.setHidden({ id: original.id, isHidden: false })
    expect(service.list()[0].isHidden).toBe(false)
  })

  it('숨긴 캐릭터와 중복되는 수정은 기존 기록을 바꾸지 않는다', () => {
    const first = service.create({ name: '본캐', world: '월드' })
    const second = service.create({ name: '부캐', world: '월드' })
    service.setHidden({ id: first.id, isHidden: true })
    expect(() => service.update({ id: second.id, name: '본캐', world: '월드', notes: '' })).toThrow(
      '이미 등록'
    )
    expect(service.list().find((item) => item.id === second.id)?.name).toBe('부캐')
  })

  it('SQL 문자열을 실행하지 않고 이름 값으로 저장한다', () => {
    const input = { name: "x'); DROP TABLE characters;--", world: '월드', notes: '' }
    const created = service.create(input)
    expect(service.list()[0]).toEqual(created)
    service.create({ name: '안전한캐릭터', world: '월드' })
    expect(service.list()).toHaveLength(2)
  })

  it('삭제할 캐릭터가 없으면 오류를 반환하고 다른 기록은 유지한다', () => {
    const character = service.create({ name: '이름', world: '월드' })
    service.remove(character.id)
    expect(service.list()).toHaveLength(0)
    expect(() => service.remove(character.id)).toThrow('찾을 수 없습니다')
  })

  it('연결된 기록이 있는 캐릭터를 삭제하지 않는다', () => {
    const character = service.create({ name: '이름', world: '월드' })
    database.exec(
      'CREATE TABLE test_records (character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT) STRICT'
    )
    database.prepare('INSERT INTO test_records VALUES (?)').run(character.id)
    expect(() => service.remove(character.id)).toThrow('숨김 기능')
    expect(service.list()).toHaveLength(1)
    expect(database.prepare('SELECT * FROM test_records').all()).toHaveLength(1)
  })

  it('더 새로운 DB를 구버전 코드로 열지 않는다', () => {
    database
      .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
      .run(4, 'future', new Date().toISOString())
    database.close()
    expect(() => openDatabase(path)).toThrow('최신 버전')
  })
})
