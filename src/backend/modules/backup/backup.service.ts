import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { openDatabase } from '../../database/connection'
import { UnitOfWork } from '../../database/unit-of-work'
import { AppError } from '../../../shared/errors'
import { readId, readObject, readText } from '../../../shared/validation'
import { readDate } from '../../../shared/dates'
import { bossWeek } from '../../../shared/boss-period'
import { parseBossMembers } from '../../../shared/contracts/boss-roster.contract'
import { readOcid } from '../../../shared/contracts/nexon.contract'
import type {
  BackupCounts,
  BackupPreview,
  BackupRestored
} from '../../../shared/contracts/backup.contract'

// Parent tables precede their dependents. File content never supplies SQL identifiers.
const TABLES = [
  'characters',
  'boss_templates',
  'boss_presets',
  'boss_roster_assignments',
  'boss_runs',
  'crystal_settlements',
  'hunting_sessions',
  'drop_lots',
  'drop_sales',
  'ledger_entries'
] as const
type Table = (typeof TABLES)[number]
type Row = Record<string, SQLInputValue>
type Tables = Record<Table, Row[]>
interface BackupFile {
  format: 'maple-roster'
  version: 1
  schemaVersion: number
  createdAt: string
  tables: Tables
}
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024
function invalid(): never {
  throw new AppError(
    'VALIDATION_ERROR',
    '백업 형식·기록·참조 관계 또는 정산 금액이 올바르지 않습니다. 기존 장부는 유지됩니다.'
  )
}
const digest = (tables: Tables) => createHash('sha256').update(JSON.stringify(tables)).digest('hex')
function counts(tables: Tables): BackupCounts {
  return {
    characters: tables.characters.length,
    bossRuns: tables.boss_runs.length,
    huntingSessions: tables.hunting_sessions.length,
    dropLots: tables.drop_lots.length,
    dropSales: tables.drop_sales.length,
    ledgerEntries: tables.ledger_entries.length,
    templates: tables.boss_templates.length
  }
}
function schemaVersion(database: DatabaseSync): number {
  return Number(
    database.prepare('SELECT MAX(version) AS version FROM schema_migrations').get()!.version
  )
}
function columns(database: DatabaseSync, table: Table): string[] {
  return database
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row.name))
}
function snapshot(database: DatabaseSync): Tables {
  return Object.fromEntries(
    TABLES.map((table) => [
      table,
      database
        .prepare(
          `SELECT * FROM ${table} ORDER BY ${table === 'boss_roster_assignments' ? 'character_id' : 'id'}`
        )
        .all()
    ])
  ) as Tables
}
function insert(database: DatabaseSync, tables: Tables): void {
  for (const table of TABLES) {
    const names = columns(database, table)
    const statement = database.prepare(
      `INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`
    )
    for (const row of tables[table]) statement.run(...names.map((name) => row[name]))
  }
}

function validateRelations(database: DatabaseSync, tables: Tables): void {
  const byId = (table: Table) => new Map(tables[table].map((row) => [row.id, row]))
  const hunts = byId('hunting_sessions'),
    bosses = byId('boss_runs'),
    lots = byId('drop_lots')
  const managedLots = new Map(
    tables.drop_lots
      .filter((row) => row.managed_kind !== null)
      .map((row) => [`${row.hunting_session_id}:${row.managed_kind}`, row])
  )
  const expected = new Map<
    string,
    { characterId: SQLInputValue; world: SQLInputValue; date: SQLInputValue; amount: SQLInputValue }
  >()
  const add = (key: string, row: Row, date: SQLInputValue, amount: SQLInputValue) => {
    if (Number(amount) > 0)
      expected.set(key, { characterId: row.character_id, world: row.world_snapshot, date, amount })
  }
  for (const row of tables.characters) {
    if (
      row.identity_key !==
      JSON.stringify([String(row.name).toLowerCase(), String(row.world).toLowerCase()])
    )
      invalid()
    if (row.nexon_ocid !== null) readOcid(row.nexon_ocid)
    if (
      row.nexon_fetched_at !== null &&
      (row.nexon_ocid === null ||
        row.nexon_level === null ||
        row.nexon_job === null ||
        row.nexon_guild === null)
    )
      invalid()
  }
  for (const table of ['boss_runs', 'boss_presets'] as const) {
    for (const row of tables[table]) {
      readText(row.boss_name, '보스', 60)
      readText(row.difficulty, '난이도', 40)
      if (row.boss_key !== String(row.boss_name).toLowerCase()) invalid()
      if (table === 'boss_runs' && bossWeek(String(row.period_start)) !== row.period_start)
        invalid()
    }
  }
  for (const row of tables.boss_templates) parseBossMembers(JSON.parse(String(row.members_json)))
  if (
    database
      .prepare(
        'SELECT 1 FROM boss_runs GROUP BY character_id,period_start HAVING COUNT(*)>12 LIMIT 1'
      )
      .get()
  )
    invalid()
  for (const row of tables.hunting_sessions) {
    for (const [kind, quantity] of [
      ['sol_fragment', row.sol_fragments],
      ['nodestone', row.nodestones]
    ] as const) {
      const lot = managedLots.get(`${row.id}:${kind}`)
      if ((Number(quantity) > 0 && !lot) || (Number(quantity) === 0 && lot)) invalid()
    }
    add(`hunting:${row.id}:income`, row, row.activity_date, row.mesos)
    add(`hunting:${row.id}:expense`, row, row.activity_date, row.cost)
  }
  for (const row of tables.crystal_settlements) {
    const boss = bosses.get(row.boss_run_id)!
    if (String(row.sold_on) < String(boss.period_start)) invalid()
    if (
      row.is_automatic === 1 &&
      row.amount !== Math.floor(Number(boss.crystal_price) / Number(boss.party_size))
    )
      invalid()
    add(`crystal:${row.id}:income`, boss, row.sold_on, row.amount)
  }
  for (const row of tables.drop_lots) {
    const source =
      row.hunting_session_id === null
        ? bosses.get(row.boss_run_id)!
        : hunts.get(row.hunting_session_id)!
    if (row.character_id !== source.character_id || row.world_snapshot !== source.world_snapshot)
      invalid()
    readText(row.item_name, '아이템', 80)
    if (!Number.isSafeInteger(Number(row.quantity) * Number(row.estimated_unit_price))) invalid()
    if (row.managed_kind !== null) {
      const quantity =
        row.managed_kind === 'sol_fragment' ? source.sol_fragments : source.nodestones
      if (row.quantity !== quantity || row.acquired_on !== source.activity_date) invalid()
    }
  }
  const sold = new Map<SQLInputValue, number>()
  for (const row of tables.drop_sales) {
    const lot = lots.get(row.drop_lot_id)!
    sold.set(row.drop_lot_id, (sold.get(row.drop_lot_id) ?? 0) + Number(row.quantity))
    if (
      (sold.get(row.drop_lot_id) ?? 0) > Number(lot.quantity) ||
      String(row.sold_on) < String(lot.acquired_on)
    )
      invalid()
    const share =
      row.share_mode === 'equal'
        ? Math.floor((Number(row.gross_amount) - Number(row.fee_amount)) / Number(row.party_size))
        : row.manual_share
    if (row.net_share !== share) invalid()
    add(`drop:${row.id}:income`, lot, row.sold_on, row.net_share)
  }
  for (const row of tables.ledger_entries) {
    const key =
      row.hunting_session_id !== null
        ? `hunting:${row.hunting_session_id}:${row.direction}`
        : row.crystal_settlement_id !== null
          ? `crystal:${row.crystal_settlement_id}:income`
          : `drop:${row.drop_sale_id}:income`
    const entry = expected.get(key)
    if (
      !entry ||
      entry.characterId !== row.character_id ||
      entry.world !== row.world_snapshot ||
      entry.date !== row.occurred_on ||
      entry.amount !== row.amount
    )
      invalid()
    expected.delete(key)
  }
  if (expected.size) invalid()
}

export class BackupService {
  private preview?: { id: string; expiresAt: string; baseline: string; file: BackupFile }
  constructor(
    private readonly database: DatabaseSync,
    private readonly saveRecovery: (content: string) => string,
    private readonly now = () => new Date()
  ) {}
  export(): string {
    const file: BackupFile = new UnitOfWork(this.database).run(() => ({
      format: 'maple-roster',
      version: 1,
      schemaVersion: schemaVersion(this.database),
      createdAt: this.now().toISOString(),
      tables: snapshot(this.database)
    }))
    const content = JSON.stringify(file, null, 2)
    if (TABLES.reduce((sum, table) => sum + file.tables[table].length, 0) > 200000)
      throw new AppError('VALIDATION_ERROR', '백업이 지원하는 전체 20만 기록 한도를 초과합니다.')
    if (Buffer.byteLength(content, 'utf8') > MAX_BACKUP_BYTES)
      throw new AppError('VALIDATION_ERROR', '백업 파일이 지원하는 50MB 한도를 초과합니다.')
    return content
  }
  prepare(content: string, fileName: string): BackupPreview {
    this.preview = undefined
    if (Buffer.byteLength(content, 'utf8') > MAX_BACKUP_BYTES)
      throw new AppError('VALIDATION_ERROR', '50MB 이하의 백업 파일을 선택해 주세요.')
    let staging: DatabaseSync | undefined
    try {
      const raw = readObject(JSON.parse(content.replace(/^\uFEFF/, '')))
      if (
        Object.keys(raw).sort().join(',') !== 'createdAt,format,schemaVersion,tables,version' ||
        raw.format !== 'maple-roster' ||
        raw.version !== 1 ||
        raw.schemaVersion !== schemaVersion(this.database)
      )
        throw new AppError(
          'VALIDATION_ERROR',
          '이 앱에서 지원하는 Maple Roster 백업 형식과 DB 버전이 아닙니다.'
        )
      if (
        typeof raw.createdAt !== 'string' ||
        new Date(raw.createdAt).toISOString() !== raw.createdAt
      )
        invalid()
      const tables = readObject(raw.tables)
      if (Object.keys(tables).sort().join(',') !== [...TABLES].sort().join(',')) invalid()
      staging = openDatabase(':memory:')
      let total = 0
      for (const table of TABLES) {
        const rows = tables[table],
          names = columns(staging, table)
        const types = new Map(
          staging
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .map((column) => [String(column.name), String(column.type)])
        )
        if (!Array.isArray(rows) || (total += rows.length) > 200000) invalid()
        for (const entry of rows as unknown[]) {
          const row = readObject(entry)
          if (Object.keys(row).sort().join(',') !== [...names].sort().join(',')) invalid()
          for (const [name, value] of Object.entries(row)) {
            if (value === null) continue
            if (types.get(name) === 'INTEGER' && typeof value !== 'number') invalid()
            if (types.get(name) === 'TEXT' && typeof value !== 'string') invalid()
            if (typeof value === 'number') {
              if (!Number.isSafeInteger(value) || value < 0) invalid()
              continue
            }
            if (
              typeof value !== 'string' ||
              value.length > (name === 'members_json' ? 20000 : 1000)
            )
              invalid()
            if (name === 'id' || name.endsWith('_id')) readId(value)
            if (
              ['activity_date', 'period_start', 'sold_on', 'acquired_on', 'occurred_on'].includes(
                name
              )
            )
              readDate(value)
            if (name.endsWith('_at') && new Date(value).toISOString() !== value) invalid()
            if (name === 'notes') readText(value, '메모', 500, false, true)
            if (['name', 'world', 'world_snapshot'].includes(name))
              readText(value, '이름·서버', name === 'name' && table !== 'characters' ? 50 : 40)
          }
        }
      }
      const typedTables = tables as unknown as Tables
      new UnitOfWork(staging).run(() => {
        insert(staging!, typedTables)
        validateRelations(staging!, typedTables)
      })
      const id = randomUUID(),
        expiresAt = new Date(this.now().getTime() + 10 * 60 * 1000).toISOString()
      this.preview = {
        id,
        expiresAt,
        baseline: digest(snapshot(this.database)),
        file: raw as unknown as BackupFile
      }
      return {
        id,
        fileName,
        createdAt: raw.createdAt,
        expiresAt,
        incoming: counts(typedTables),
        current: counts(snapshot(this.database))
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      return invalid()
    } finally {
      staging?.close()
    }
  }
  cancel(): void {
    this.preview = undefined
  }
  restore(value: unknown): BackupRestored {
    const id = readId(readObject(value).previewId),
      preview = this.preview
    if (!preview || preview.id !== id || preview.expiresAt <= this.now().toISOString()) {
      this.preview = undefined
      throw new AppError(
        'REQUEST_CONFLICT',
        '복원 확인이 만료되었습니다. 백업 파일을 다시 선택해 주세요.'
      )
    }
    if (digest(snapshot(this.database)) !== preview.baseline)
      throw new AppError(
        'REQUEST_CONFLICT',
        '파일 확인 이후 장부가 변경되었습니다. 백업 파일을 다시 선택해 주세요.'
      )
    let recoveryPath: string
    try {
      recoveryPath = this.saveRecovery(this.export())
    } catch {
      throw new AppError(
        'DATABASE_ERROR',
        '현재 장부의 안전 백업을 저장하지 못해 복원을 중단했습니다. 저장 공간과 권한을 확인하세요.'
      )
    }
    try {
      new UnitOfWork(this.database).run(() => {
        for (const table of [...TABLES].reverse())
          this.database.prepare(`DELETE FROM ${table}`).run()
        insert(this.database, preview.file.tables)
      })
    } catch {
      throw new AppError(
        'DATABASE_ERROR',
        '복원 저장에 실패했습니다. 기존 장부는 그대로 유지됩니다.'
      )
    }
    this.preview = undefined
    return { recoveryPath, counts: counts(preview.file.tables) }
  }
}
