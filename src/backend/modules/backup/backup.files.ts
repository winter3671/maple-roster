import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors'
import { MAX_BACKUP_BYTES } from './backup.service'
import { saveAtomicTextFile } from '../../files/atomic-text-file'

export function readBackupFile(path: string): string {
  try {
    if (extname(path).toLowerCase() !== '.json' || statSync(path).size > MAX_BACKUP_BYTES)
      throw new AppError('VALIDATION_ERROR', '50MB 이하의 JSON 백업 파일을 선택해 주세요.')
    const buffer = readFileSync(path)
    if (buffer.length > MAX_BACKUP_BYTES)
      throw new AppError('VALIDATION_ERROR', '50MB 이하의 JSON 백업 파일을 선택해 주세요.')
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(
      'DATABASE_ERROR',
      '백업 파일을 읽지 못했습니다. 파일 위치와 읽기 권한을 확인하세요.'
    )
  }
}
export function saveBackupFile(path: string, contents: string): void {
  saveAtomicTextFile(path, contents, '.json', '백업')
}
export function saveRecoveryBackup(directory: string, contents: string): string {
  mkdirSync(directory, { recursive: true })
  const path = join(
    directory,
    `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`
  )
  saveBackupFile(path, contents)
  return path
}
