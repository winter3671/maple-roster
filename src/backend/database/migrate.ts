import type { DatabaseSync } from 'node:sqlite'
import charactersSql from './migrations/001_characters.sql?raw'
import huntingSql from './migrations/002_hunting_ledger.sql?raw'
import bossesSql from './migrations/003_bosses.sql?raw'
import dropsSql from './migrations/004_drops.sql?raw'
import rostersSql from './migrations/005_boss_rosters.sql?raw'
import clearIncomeSql from './migrations/006_boss_clear_income.sql?raw'
import profilesSql from './migrations/007_character_profiles.sql?raw'
import partyReviewSql from './migrations/008_boss_party_review.sql?raw'

const migrations = [
  { version: 1, name: 'characters', sql: charactersSql },
  { version: 2, name: 'hunting_ledger', sql: huntingSql },
  { version: 3, name: 'bosses', sql: bossesSql },
  { version: 4, name: 'drops', sql: dropsSql },
  { version: 5, name: 'boss_rosters', sql: rostersSql },
  { version: 6, name: 'boss_clear_income', sql: clearIncomeSql },
  { version: 7, name: 'character_profiles', sql: profilesSql },
  { version: 8, name: 'boss_party_review', sql: partyReviewSql }
]

export function migrate(database: DatabaseSync): void {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`)
  const rows = database.prepare('SELECT version FROM schema_migrations ORDER BY version').all()
  const applied = new Set(rows.map((row) => Number(row.version)))
  if ([...applied].some((version) => version > migrations.length)) {
    throw new Error('현재 앱보다 새로운 데이터베이스입니다. 최신 버전의 앱을 사용해 주세요.')
  }
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    database.exec('BEGIN IMMEDIATE')
    try {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString())
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}
