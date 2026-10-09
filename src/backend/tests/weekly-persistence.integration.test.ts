import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { migrate } from '../database/migrate'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { WeeklyRepository } from '../modules/weekly/weekly.repository'
import { WeeklyService } from '../modules/weekly/weekly.service'
import { AppError } from '../../shared/errors'
import type { NexonClient } from '../integrations/nexon/nexon.client'

describe('주간 콘텐츠 저장과 보관 기간', () => {
  let directory: string, file: string, db: DatabaseSync, id: string, now: Date
  const contents = [
    { name: '[길드] 지하 수로', count: 12345, maximum: 0 },
    { name: '[길드] 플래그 레이스', count: 300, maximum: 0 }
  ]
  let client: { weeklyContents: ReturnType<typeof vi.fn<NexonClient['weeklyContents']>> }
  const service = () =>
    new WeeklyService(client, new CharacterRepository(db), () => now, new WeeklyRepository(db))
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-weekly-persistence-'))
    file = join(directory, 'data.sqlite')
    db = openDatabase(file)
    const characters = new CharacterService(new CharacterRepository(db))
    id = characters.create({ name: '주간보관', world: '레드', notes: '' }).id
    db.prepare('UPDATE characters SET nexon_ocid=? WHERE id=?').run('test-ocid', id)
    now = new Date('2026-10-14T14:59:59Z')
    client = { weeklyContents: vi.fn(async () => contents) }
  })
  afterEach(() => {
    if (db.isOpen) db.close()
    if (
      dirname(resolve(directory)) !== resolve(tmpdir()) ||
      !basename(directory).startsWith('maple-weekly-persistence-')
    )
      throw new Error('잘못된 정리 경로')
    rmSync(directory, { recursive: true, force: true })
  })
  it('DB를 닫고 재실행해도 저장된 점수를 API 호출 없이 읽는다', async () => {
    await service().sync()
    db.close()
    db = openDatabase(file)
    expect(service().list().characters[0].contents).toEqual(contents)
    expect(client.weeklyContents).toHaveBeenCalledTimes(1)
  })
  it('목요일 00시에 지난주로 넘기고 다음 목요일에는 2주 전 기록을 삭제한다', async () => {
    const weekly = service()
    await weekly.sync()
    now = new Date('2026-10-14T15:00:00Z')
    const next = weekly.list()
    expect(next.week).toBe('2026-10-15')
    expect(next.characters[0].contents).toBeUndefined()
    expect(next.previous.characters[0].contents).toEqual(contents)
    await weekly.sync()
    now = new Date('2026-10-21T15:00:00Z')
    expect(weekly.list().previous.week).toBe('2026-10-15')
    expect(new WeeklyRepository(db).get(id, '2026-10-08')).toBeUndefined()
    expect(db.prepare('SELECT week FROM weekly_content_snapshots').all()).toEqual([
      { week: '2026-10-15' }
    ])
  })
  it('갱신 실패 후에도 마지막 저장 결과를 유지하며 잘못된 캐릭터에 재사용하지 않는다', async () => {
    const weekly = service()
    await weekly.sync()
    client.weeklyContents.mockRejectedValue(new AppError('API_NETWORK_ERROR', '연결 실패'))
    const failed = await weekly.sync()
    expect(failed.characters[0]).toMatchObject({ contents, error: '연결 실패' })
    db.prepare('UPDATE characters SET nexon_ocid=? WHERE id=?').run('other-ocid', id)
    expect(weekly.list().characters[0].contents).toBeUndefined()
  })
  it('캐릭터 삭제 시 저장된 주간 기록도 지운다', async () => {
    const weekly = service()
    await weekly.sync()
    expect(db.prepare('SELECT * FROM weekly_content_snapshots').all()).toHaveLength(1)
    new CharacterService(new CharacterRepository(db)).remove(id)
    expect(db.prepare('SELECT * FROM weekly_content_snapshots').all()).toEqual([])
    expect(weekly.list().characters).toEqual([])
  })
  it('조회 중 삭제한 캐릭터의 결과는 저장하지 않는다', async () => {
    let finish!: (value: typeof contents) => void
    client.weeklyContents.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const weekly = service()
    const pending = weekly.sync()
    new CharacterService(new CharacterRepository(db)).remove(id)
    finish(contents)
    expect((await pending).characters).toEqual([])
    expect(db.prepare('SELECT * FROM weekly_content_snapshots').all()).toEqual([])
  })
  it('이전 숨김 상태를 업그레이드할 때 표시 상태로 전환하고 입력 API에서는 제거한다', () => {
    db.exec(
      'DROP TABLE weekly_content_snapshots; DELETE FROM schema_migrations WHERE version=14; UPDATE characters SET is_hidden=1;'
    )
    migrate(db)
    const characters = new CharacterService(new CharacterRepository(db))
    expect(db.prepare('SELECT is_hidden FROM characters').get()?.is_hidden).toBe(0)
    expect(characters.list()[0]).not.toHaveProperty('isHidden')
    expect(characters).not.toHaveProperty('setHidden')
  })
})
