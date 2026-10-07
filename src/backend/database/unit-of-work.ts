import type { DatabaseSync } from 'node:sqlite'

export class UnitOfWork {
  constructor(private readonly database: DatabaseSync) {}
  run<T>(operation: () => T): T {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.database.exec('COMMIT')
      return result
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }
}
