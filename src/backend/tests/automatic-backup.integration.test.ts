import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createServices, type Services } from '../../desktop/main/bootstrap'
import { AutomaticBackupService } from '../modules/backup/automatic-backup.service'

describe('자동 장부 백업', () => {
  let root: string, services: Services, directory: string, clock: Date
  let automatic: AutomaticBackupService
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'maple-auto-backup-'))
    services = createServices('test', join(root, 'data', 'test.sqlite'))
    directory = join(root, 'backups', 'automatic')
    clock = new Date('2026-10-08T00:00:00Z')
    automatic = new AutomaticBackupService(
      directory,
      () => services.backup.export(),
      () => clock
    )
  })
  afterEach(() => {
    services.close()
    const target = resolve(root)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('maple-auto-backup-'))
      throw new Error('Unsafe cleanup')
    rmSync(target, { recursive: true, force: true })
  })
  it('첫 저장, 변경 없는 반복 실행·재시작 중복 방지와 변경 후 복원 가능한 백업', () => {
    const first = automatic.check()
    expect(first.error).toBeNull()
    expect(first.count).toBe(1)
    expect(automatic.check().lastFilePath).toBe(first.lastFilePath)
    automatic = new AutomaticBackupService(
      directory,
      () => services.backup.export(),
      () => clock
    )
    expect(automatic.check().count).toBe(1)
    const character = services.characters.create({ name: '백업캐릭터', world: '루나' })
    clock = new Date(clock.getTime() + 3600000)
    const changed = automatic.check()
    expect(changed.count).toBe(2)
    const content = readFileSync(changed.lastFilePath!, 'utf8')
    expect(content).toContain(character.name)
    expect(JSON.parse(content).tables).not.toHaveProperty('nexon_api_key')
    services.characters.create({ name: '이후기록', world: '루나' })
    const preview = services.backup.prepare(content, basename(changed.lastFilePath!))
    services.backup.restore({ previewId: preview.id })
    expect(services.characters.list().map((c) => c.name)).toEqual(['백업캐릭터'])
  })
  it('새 백업 저장 후 최근 30개만 유지하며 복원 전·사용자 파일은 보존한다', () => {
    automatic.check()
    writeFileSync(join(directory, 'user.json'), '{"keep":true}')
    writeFileSync(join(directory, 'before-restore-test.json'), '{"keep":true}')
    for (let index = 0; index < 32; index++) {
      clock = new Date(clock.getTime() + 3600000)
      expect(automatic.check(true).error).toBeNull()
    }
    expect(automatic.status().count).toBe(30)
    expect(readdirSync(directory)).toHaveLength(32)
    expect(readFileSync(join(directory, 'user.json'), 'utf8')).toBe('{"keep":true}')
    const newest = automatic.status().lastFilePath!
    expect(readdirSync(directory)).toContain(basename(newest))
  })
  it('저장 실패 시 기존 파일을 삭제하지 않고 상태를 안내하며 재시도한다', () => {
    automatic.check()
    const original = readdirSync(directory)
    let failing = true
    const retry = new AutomaticBackupService(
      directory,
      () => services.backup.export(),
      () => clock,
      (path, content) => {
        if (failing) throw new Error('Disk full')
        writeFileSync(path, content)
      }
    )
    expect(retry.check(true).error).toContain('실패')
    expect(readdirSync(directory)).toEqual(original)
    failing = false
    expect(retry.check(true).error).toBeNull()
    expect(retry.status().count).toBe(2)
  })
  it('읽을 수 없는 자동 파일은 중복 판단·삭제 대상에서 제외한다', () => {
    const first = automatic.check()
    writeFileSync(first.lastFilePath!, 'corrupt')
    clock = new Date(clock.getTime() + 3600000)
    expect(automatic.check().count).toBe(1)
    expect(readFileSync(first.lastFilePath!, 'utf8')).toBe('corrupt')
    expect(readdirSync(directory)).toHaveLength(2)
  })
  it('앱 초기화 자체를 막지 않고 백업 생성 오류를 상태에 남긴다', () => {
    const failing = new AutomaticBackupService(directory, () => {
      throw new Error('Export limit')
    })
    expect(failing.check().error).toContain('실패')
    expect(failing.status().lastFilePath).toBeNull()
    expect(readdirSync(directory)).toEqual([])
  })
})
