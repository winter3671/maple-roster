import { appendFile, mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import type { DiagnosticStatus } from '../../shared/contracts/diagnostics.contract'

export const DIAGNOSTIC_FILE_LIMIT = 512 * 1024
const events = [
  'app.started',
  'app.stopped',
  'app.failed',
  'request.failed',
  'request.partial',
  'request.slow',
  'backup.failed',
  'update.failed',
  'renderer.gone',
  'renderer.unresponsive',
  'renderer.failed'
] as const
type Event = (typeof events)[number]
const operations = new Set<string>([
  ...Object.values(IPC_CHANNELS),
  'startup',
  'shutdown',
  'automatic-backup',
  'check',
  'download',
  'install',
  'page',
  'error',
  'unhandled-rejection',
  'renderer'
])
const codes = new Set([
  'VALIDATION_ERROR',
  'DUPLICATE_CHARACTER',
  'CHARACTER_NOT_FOUND',
  'CHARACTER_IN_USE',
  'DATABASE_ERROR',
  'PERMISSION_DENIED',
  'SESSION_NOT_FOUND',
  'REQUEST_CONFLICT',
  'API_KEY_MISSING',
  'API_KEY_INVALID',
  'API_KEY_STORAGE_ERROR',
  'API_PERMISSION_DENIED',
  'API_RATE_LIMITED',
  'API_UNAVAILABLE',
  'API_NETWORK_ERROR',
  'API_RESPONSE_INVALID',
  'BOSS_NOT_FOUND',
  'DUPLICATE_BOSS',
  'BOSS_ALREADY_SETTLED',
  'DROP_NOT_FOUND',
  'DROP_IN_USE',
  'INSUFFICIENT_DROP_QUANTITY',
  'UNEXPECTED_ERROR',
  'NEWER_DATABASE',
  'ENOSPC',
  'EACCES',
  'EPERM',
  'ENOENT',
  'EBUSY',
  'EIO',
  'ERR_SQLITE_ERROR',
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_CORRUPT',
  'SQLITE_NOTADB',
  'SQLITE_FULL'
])
const reasons = new Set([
  'clean-exit',
  'abnormal-exit',
  'killed',
  'crashed',
  'oom',
  'launch-failed',
  'integrity-failure'
])
export interface DiagnosticEvent {
  event: Event
  operation?: string
  code?: string
  durationMs?: number
  failed?: number
  reason?: string
}
interface Entry extends DiagnosticEvent {
  at: string
  appVersion?: string
}
export function diagnosticCode(error: unknown): string {
  try {
    const code =
      typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
    return typeof code === 'string' && codes.has(code) ? code : 'UNEXPECTED_ERROR'
  } catch {
    return 'UNEXPECTED_ERROR'
  }
}
function sanitize(value: unknown, at: string): Entry | undefined {
  if (typeof value !== 'object' || value === null) return
  const row = value as Record<string, unknown>
  if (!events.includes(row.event as Event)) return
  const entry: Entry = { at, event: row.event as Event }
  if (typeof row.appVersion === 'string') entry.appVersion = safeVersion(row.appVersion)
  if (typeof row.operation === 'string' && operations.has(row.operation))
    entry.operation = row.operation
  if (typeof row.code === 'string') entry.code = codes.has(row.code) ? row.code : 'UNEXPECTED_ERROR'
  if (typeof row.reason === 'string' && reasons.has(row.reason)) entry.reason = row.reason
  for (const field of ['durationMs', 'failed'] as const) {
    if (typeof row[field] === 'number' && Number.isFinite(row[field]) && row[field] >= 0)
      entry[field] = Math.min(86400000, Math.round(row[field]))
  }
  return entry
}
const safeVersion = (value: string) =>
  /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value) && value.length < 64 ? value : 'unknown'

export class DiagnosticLog {
  private queue: Promise<void>
  private size = 0
  private pending = 0
  private writeIssue = false
  private dropped = 0
  private paths: string[]
  constructor(
    private readonly directory: string,
    private readonly metadata: {
      appVersion: string
      electronVersion: string
      nodeVersion: string
      platform: string
    },
    private readonly limit = DIAGNOSTIC_FILE_LIMIT
  ) {
    this.paths = [0, 1, 2].map((n) => join(directory, `diagnostics${n ? `.${n}` : ''}.jsonl`))
    this.queue = this.initialize().catch(() => {
      this.writeIssue = true
    })
  }
  private async initialize() {
    await mkdir(this.directory, { recursive: true })
    try {
      this.size = (await stat(this.paths[0])).size
    } catch (error) {
      if (diagnosticCode(error) !== 'ENOENT') throw error
    }
  }
  record(value: DiagnosticEvent) {
    const entry = sanitize(
      { ...value, appVersion: this.metadata.appVersion },
      new Date().toISOString()
    )
    if (!entry) return
    if (this.pending >= 64) {
      this.dropped++
      return
    }
    const line = JSON.stringify(entry) + '\n'
    const bytes = Buffer.byteLength(line)
    if (bytes > this.limit) {
      this.dropped++
      return
    }
    this.pending++
    this.queue = this.queue.then(async () => {
      try {
        await mkdir(this.directory, { recursive: true })
        if (this.size + bytes > this.limit) {
          await rm(this.paths[2], { force: true })
          for (let n = 1; n >= 0; n--) {
            try {
              await rename(this.paths[n], this.paths[n + 1])
            } catch (error) {
              if (diagnosticCode(error) !== 'ENOENT') throw error
            }
          }
          this.size = 0
        }
        await appendFile(this.paths[0], line, { encoding: 'utf8', mode: 0o600 })
        this.size += bytes
        this.writeIssue = false
      } catch {
        this.writeIssue = true
        // An interrupted append may have written only part of a line.
        try {
          this.size = (await stat(this.paths[0])).size
        } catch (error) {
          if (diagnosticCode(error) === 'ENOENT') this.size = 0
        }
      } finally {
        this.pending--
      }
    })
  }
  flush() {
    return this.queue
  }
  async status(): Promise<DiagnosticStatus> {
    await this.flush()
    let files = 0,
      bytes = 0
    for (const path of this.paths) {
      try {
        const info = await stat(path)
        files++
        bytes += info.size
      } catch (error) {
        if (diagnosticCode(error) !== 'ENOENT') this.writeIssue = true
      }
    }
    return { files, bytes, writeIssue: this.writeIssue, dropped: this.dropped }
  }
  exportFile(filePath: string): Promise<number> {
    const operation = this.queue.then(() => this.writeExportFile(filePath))
    this.queue = operation.then(
      () => {},
      () => {}
    )
    return operation
  }
  private async writeExportFile(filePath: string): Promise<number> {
    const entries: Entry[] = []
    for (const path of [...this.paths].reverse()) {
      let file: Awaited<ReturnType<typeof open>> | undefined
      try {
        file = await open(path, 'r')
        const buffer = Buffer.alloc(this.limit)
        let length = 0
        while (length < buffer.length) {
          const { bytesRead } = await file.read(buffer, length, buffer.length - length, length)
          if (!bytesRead) break
          length += bytesRead
        }
        for (const line of buffer.subarray(0, length).toString('utf8').split('\n')) {
          try {
            const row = JSON.parse(line)
            if (
              typeof row.at !== 'string' ||
              !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.at) ||
              !Number.isFinite(Date.parse(row.at))
            )
              continue
            const entry = sanitize(row, row.at)
            if (entry) entries.push(entry)
          } catch {
            /* Ignore invalid lines; never export raw text. */
          }
        }
      } catch (error) {
        if (diagnosticCode(error) !== 'ENOENT') throw error
      } finally {
        await file?.close()
      }
    }
    await writeFile(
      filePath,
      JSON.stringify(
        {
          format: 'maple-roster-diagnostics',
          version: 1,
          createdAt: new Date().toISOString(),
          appVersion: safeVersion(this.metadata.appVersion),
          electronVersion: safeVersion(this.metadata.electronVersion),
          nodeVersion: safeVersion(this.metadata.nodeVersion),
          platform: ['win32', 'darwin', 'linux'].includes(this.metadata.platform)
            ? this.metadata.platform
            : 'unknown',
          entries
        },
        null,
        2
      ),
      { encoding: 'utf8', mode: 0o600 }
    )
    return entries.length
  }
}

let recorder: ((event: DiagnosticEvent) => void) | undefined
export function setDiagnosticRecorder(value?: (event: DiagnosticEvent) => void) {
  recorder = value
}
export function recordDiagnostic(event: DiagnosticEvent) {
  try {
    recorder?.(event)
  } catch {
    /* Logging must not change the user's operation. */
  }
}
export function recordRequestResult(operation: string, result: unknown, durationMs: number) {
  if (durationMs >= 2000) recordDiagnostic({ event: 'request.slow', operation, durationMs })
  if (
    operation === IPC_CHANNELS.backupAutomaticNow &&
    result &&
    typeof result === 'object' &&
    (result as { error?: unknown }).error
  )
    recordDiagnostic({ event: 'backup.failed', operation })
  const batch = [
    IPC_CHANNELS.nexonSyncProfiles,
    IPC_CHANNELS.nexonRegisterMany,
    IPC_CHANNELS.bossesSyncClears,
    IPC_CHANNELS.bossesSyncPeriods,
    IPC_CHANNELS.weeklySync
  ] as string[]
  if (!batch.includes(operation)) return
  const rows = Array.isArray(result)
    ? result.flatMap((row) => (row?.error ? [{ error: row.error }] : (row?.result?.items ?? [])))
    : ((result as { items?: unknown[]; characters?: unknown[] } | null)?.items ??
      (result as { characters?: unknown[] } | null)?.characters ??
      [])
  const failures = rows.filter(
    (row) =>
      row &&
      typeof row === 'object' &&
      ((row as { error?: unknown }).error ||
        ['failed', 'notAttempted'].includes((row as { status?: string }).status ?? ''))
  )
  const byCode = new Map<string, number>()
  for (const row of failures) {
    const code = diagnosticCode((row as { error?: unknown }).error)
    byCode.set(code, (byCode.get(code) ?? 0) + 1)
  }
  for (const [code, failed] of byCode)
    recordDiagnostic({ event: 'request.partial', operation, code, failed, durationMs })
}
