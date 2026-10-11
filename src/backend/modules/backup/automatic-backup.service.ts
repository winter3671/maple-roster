import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { readBackupFile, saveBackupFile } from './backup.files'
import type { AutomaticBackupStatus } from '../../../shared/contracts/backup.contract'

export const AUTOMATIC_BACKUP_INTERVAL = 60 * 60 * 1000
export const AUTOMATIC_BACKUP_LIMIT = 30
const managedName = /^auto-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}\.json$/
function fingerprint(content: string): string {
  const file = JSON.parse(content)
  if (
    file.format !== 'maple-roster' ||
    file.version !== 1 ||
    !file.tables ||
    !Number.isInteger(file.schemaVersion) ||
    !Number.isFinite(Date.parse(file.createdAt))
  )
    throw new Error('Invalid backup')
  return createHash('sha256')
    .update(JSON.stringify([file.schemaVersion, file.tables]))
    .digest('hex')
}

export class AutomaticBackupService {
  private state: AutomaticBackupStatus
  private readonly files = new Map<
    string,
    { signature: string; fingerprint: string; createdAt: string }
  >()
  private lastRevision: string | undefined
  private lastFingerprint: string | undefined
  constructor(
    private readonly directory: string,
    private readonly exportBackup: () => string,
    private readonly now: () => Date = () => new Date(),
    private readonly save: (path: string, content: string) => void = saveBackupFile,
    private readonly revision?: () => string
  ) {
    this.state = { directory, lastSavedAt: null, lastFilePath: null, count: 0, error: null }
  }
  status(): AutomaticBackupStatus {
    return { ...this.state }
  }
  check(force = false): AutomaticBackupStatus {
    try {
      mkdirSync(this.directory, { recursive: true })
      const files = readdirSync(this.directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && managedName.test(entry.name))
        .flatMap((entry) => {
          const path = join(this.directory, entry.name)
          try {
            const stat = statSync(path, { bigint: true })
            const signature = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`
            const cached = this.files.get(path)
            if (cached?.signature === signature) return [{ path, name: entry.name, ...cached }]
            const content = readBackupFile(path)
            const metadata = {
              signature,
              fingerprint: fingerprint(content),
              createdAt: String(JSON.parse(content).createdAt)
            }
            this.files.set(path, metadata)
            return [{ path, name: entry.name, ...metadata }]
          } catch {
            this.files.delete(path)
            return []
          }
        })
        .sort((a, b) => b.name.localeCompare(a.name))
      const paths = new Set(files.map((file) => file.path))
      for (const path of this.files.keys()) if (!paths.has(path)) this.files.delete(path)
      this.state = {
        directory: this.directory,
        lastSavedAt: files[0]?.createdAt ?? null,
        lastFilePath: files[0]?.path ?? null,
        count: files.length,
        error: null
      }
      const revision = this.revision?.()
      // A revision only skips export after a successful snapshot comparison in this process.
      // Re-read directory/stat metadata first so deleted or replaced snapshots are detected.
      if (
        !force &&
        revision !== undefined &&
        revision === this.lastRevision &&
        files[0]?.fingerprint === this.lastFingerprint
      )
        return this.status()
      const content = this.exportBackup()
      const hash = fingerprint(content)
      if (!force && files[0]?.fingerprint === hash) {
        this.lastRevision = revision
        this.lastFingerprint = hash
        return this.status()
      }
      const path = join(
        this.directory,
        `auto-${this.now().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`
      )
      this.save(path, content)
      this.state.lastFilePath = path
      this.state.lastSavedAt = String(JSON.parse(content).createdAt)
      this.state.count = files.length + 1
      // Only recognized, readable automatic snapshots are removed, after the new save succeeds.
      for (const file of files.slice(AUTOMATIC_BACKUP_LIMIT - 1)) {
        unlinkSync(file.path)
        this.files.delete(file.path)
        this.state.count--
      }
      this.lastRevision = revision
      this.lastFingerprint = hash
    } catch {
      this.state.error =
        '자동 백업 또는 오래된 백업 정리에 실패했습니다. 저장 공간과 폴더 권한을 확인한 뒤 다시 시도해 주세요.'
    }
    return this.status()
  }
}
