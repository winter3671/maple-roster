import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { HuntingSession } from '../../../shared/contracts/hunting.contract'
import type { LedgerEntry, RecordQuery } from '../../../shared/contracts/ledger.contract'

export class LedgerRepository {
  constructor(private readonly database: DatabaseSync) {}

  syncHunting(session: HuntingSession): void {
    for (const [direction, amount] of [
      ['income', session.mesos],
      ['expense', session.cost]
    ] as const) {
      if (amount === 0) {
        this.database
          .prepare('DELETE FROM ledger_entries WHERE hunting_session_id = ? AND direction = ?')
          .run(session.id, direction)
      } else {
        this.database
          .prepare(
            `INSERT INTO ledger_entries (id, hunting_session_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(hunting_session_id, direction) DO UPDATE SET character_id = excluded.character_id, world_snapshot = excluded.world_snapshot, occurred_on = excluded.occurred_on, amount = excluded.amount, updated_at = excluded.updated_at`
          )
          .run(
            randomUUID(),
            session.id,
            session.characterId,
            session.characterWorld,
            session.date,
            direction,
            amount,
            session.createdAt,
            session.updatedAt
          )
      }
    }
  }

  list(query: RecordQuery): LedgerEntry[] {
    return this.database
      .prepare(
        `SELECT e.*, c.name AS character_name FROM ledger_entries e JOIN characters c ON c.id = e.character_id
      WHERE occurred_on BETWEEN ? AND ? ${query.characterId ? 'AND e.character_id = ?' : ''} ORDER BY occurred_on DESC, e.created_at DESC, e.id`
      )
      .all(query.from, query.to, ...(query.characterId ? [query.characterId] : []))
      .map((row) => ({
        id: String(row.id),
        huntingSessionId: String(row.hunting_session_id),
        characterId: String(row.character_id),
        characterName: String(row.character_name),
        characterWorld: String(row.world_snapshot),
        date: String(row.occurred_on),
        direction: row.direction as 'income' | 'expense',
        amount: Number(row.amount)
      }))
  }
}
