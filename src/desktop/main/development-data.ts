import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { DatabaseSync, backup } from 'node:sqlite'
import { backupForRecovery } from './recovery-backup'

function hasRecords(database: DatabaseSync): boolean {
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'"
    )
    .all()
  return tables.some(
    (table) =>
      database
        .prepare(`SELECT 1 FROM "${String(table.name).replaceAll('"', '""')}" LIMIT 1`)
        .get() !== undefined
  )
}

// Called after acquiring the app's instance lock, before opening development services.
// Preserve the installed ledger; never replace an existing development ledger with records.
export async function seedDevelopmentData(
  installedDirectory: string,
  developmentDirectory: string
): Promise<boolean> {
  const sourcePath = join(installedDirectory, 'data', 'maple-roster.sqlite')
  const targetPath = join(developmentDirectory, 'data', 'maple-roster.sqlite')
  const marker = join(developmentDirectory, 'installed-ledger-seeded')
  if (existsSync(marker) || !existsSync(sourcePath) || sourcePath === targetPath) return false
  if (existsSync(targetPath)) {
    const target = new DatabaseSync(targetPath, { readOnly: true })
    try {
      if (hasRecords(target)) return false
    } finally {
      target.close()
    }
  }
  const source = new DatabaseSync(sourcePath, { readOnly: true })
  try {
    if (!hasRecords(source)) return false
    mkdirSync(dirname(targetPath), { recursive: true })
    if (existsSync(targetPath)) backupForRecovery(targetPath)
    await backup(source, targetPath)
    writeFileSync(marker, new Date().toISOString(), { encoding: 'utf8', flag: 'wx' })
    return true
  } finally {
    source.close()
  }
}
