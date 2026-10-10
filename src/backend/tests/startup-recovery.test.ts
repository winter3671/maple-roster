import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { dataDirectory } from '../../desktop/main/data-directory'
import { backupForRecovery } from '../../desktop/main/recovery-backup'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (
      dirname(resolve(directory)) !== resolve(tmpdir()) ||
      !basename(directory).startsWith('maple-recovery-')
    )
      throw Error('cleanup guard')
    rmSync(directory, { recursive: true, force: true })
  }
})
describe('설치 앱과 개발 실행의 장부 분리 및 업데이트 복구', () => {
  it('설치 장부 경로는 유지하고 개발 장부만 별도로 사용한다', () => {
    expect(dataDirectory('base', true)).toBe(join('base', 'maple-roster'))
    expect(dataDirectory('base', false)).toBe(join('base', 'maple-roster-dev'))
    expect(dataDirectory('base', false, 'isolated')).toBe('isolated')
    expect(dataDirectory('base', true, 'isolated')).toBe('isolated')
  })
  it('알 수 없는 미래 DB도 WAL의 최신 기록까지 백업하며 원본은 변경하지 않는다', () => {
    const directory = mkdtempSync(join(tmpdir(), 'maple-recovery-'))
    directories.push(directory)
    const file = join(directory, 'ledger.sqlite')
    const database = new DatabaseSync(file)
    try {
      database.exec(
        "PRAGMA journal_mode=WAL; CREATE TABLE future_ledger(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO future_ledger VALUES (1,'keep');"
      )
      const backup = new DatabaseSync(backupForRecovery(file), { readOnly: true })
      try {
        expect(backup.prepare('SELECT * FROM future_ledger').all()).toEqual([
          { id: 1, value: 'keep' }
        ])
      } finally {
        backup.close()
      }
      expect(database.prepare('SELECT * FROM future_ledger').all()).toEqual([
        { id: 1, value: 'keep' }
      ])
    } finally {
      database.close()
    }
  })
})
