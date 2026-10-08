import {
  closeSync,
  existsSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  fsyncSync
} from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { AppError } from '../../shared/errors'

export function saveAtomicTextFile(
  path: string,
  contents: string,
  extension: '.json' | '.csv',
  label: string
): void {
  if (extname(path).toLowerCase() !== extension)
    throw new AppError('VALIDATION_ERROR', `${label} 파일 확장자는 ${extension}이어야 합니다.`)
  const temporary = join(dirname(path), `.maple-export-${randomUUID()}.tmp`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(temporary, 'wx', 0o600)
    writeFileSync(descriptor, contents, 'utf8')
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, path)
  } catch {
    throw new AppError(
      'DATABASE_ERROR',
      `${label} 파일을 저장하지 못했습니다. 저장 공간과 권한을 확인하세요.`
    )
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}
