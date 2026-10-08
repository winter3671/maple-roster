import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { readBackupFile, saveBackupFile, saveRecoveryBackup } from '../modules/backup/backup.files'

describe('백업 파일 저장과 읽기', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-backup-files-'))
  })
  afterEach(() => {
    const target = resolve(directory)
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith('maple-backup-files-')
    )
      throw new Error('Unsafe cleanup')
    rmSync(target, { recursive: true, force: true })
  })
  it('완료된 JSON으로만 교체하고 읽으며 임시 파일을 남기지 않는다', () => {
    const target = join(directory, '장부.json')
    writeFileSync(target, 'old')
    saveBackupFile(target, '{"new":true}')
    expect(readBackupFile(target)).toBe('{"new":true}')
    expect(readdirSync(directory)).toEqual(['장부.json'])
  })
  it('잘못된 확장자와 저장 실패 시 원본을 보존하고 임시 파일을 정리한다', () => {
    const protectedFile = join(directory, 'data.sqlite')
    writeFileSync(protectedFile, 'original')
    expect(() => saveBackupFile(protectedFile, 'overwrite')).toThrow('.json')
    expect(readFileSync(protectedFile, 'utf8')).toBe('original')
    const target = join(directory, 'directory.json')
    mkdirSync(target)
    expect(() => saveBackupFile(target, '{}')).toThrow('저장하지 못')
    expect(readdirSync(directory).some((name) => name.startsWith('.maple-backup-'))).toBe(false)
    expect(() => readBackupFile(protectedFile)).toThrow('JSON')
    expect(() => readBackupFile(join(directory, 'missing.json'))).toThrow('읽지 못')
    const malformed = join(directory, 'invalid-utf8.json')
    writeFileSync(malformed, Buffer.from([0xff, 0xfe]))
    expect(() => readBackupFile(malformed)).toThrow('읽지 못')
  })
  it('복원 전 안전 백업은 서로 다른 이름으로 모두 유지한다', () => {
    const recovery = join(directory, 'backups')
    const first = saveRecoveryBackup(recovery, '{"first":true}'),
      second = saveRecoveryBackup(recovery, '{"second":true}')
    expect(first).not.toBe(second)
    expect(readBackupFile(first)).toBe('{"first":true}')
    expect(readBackupFile(second)).toBe('{"second":true}')
    expect(readdirSync(recovery)).toHaveLength(2)
  })
})
