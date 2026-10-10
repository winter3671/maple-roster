import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

// Copy an unknown schema without applying migrations or interpreting ledger rows.
export function backupForRecovery(databasePath: string): string {
  const directory = join(dirname(databasePath), '..', 'backups', 'recovery')
  mkdirSync(directory, { recursive: true })
  const target = join(directory, `before-update-${randomUUID()}.sqlite`)
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`)
    return target
  } finally {
    database.close()
  }
}
