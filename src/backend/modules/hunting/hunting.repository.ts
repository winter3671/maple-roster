import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import type { HuntingSession } from '../../../shared/contracts/hunting.contract'
import type { RecordQuery } from '../../../shared/contracts/ledger.contract'
import { huntingProfit } from '../../domain/hunting-profit'

const select = `SELECT s.*, c.name AS character_name FROM hunting_sessions s JOIN characters c ON c.id = s.character_id`

function mapRow(row: Record<string, SQLOutputValue>): HuntingSession {
  const input = { minutes: Number(row.minutes), mesos: Number(row.mesos), cost: Number(row.cost) }
  return {
    id: String(row.id),
    characterId: String(row.character_id),
    characterName: String(row.character_name),
    characterWorld: String(row.world_snapshot),
    date: String(row.activity_date),
    ...input,
    solFragments: Number(row.sol_fragments),
    nodestones: Number(row.nodestones),
    notes: String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    saleIncome: 0,
    ...huntingProfit(input)
  }
}

export class HuntingRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(query: RecordQuery): HuntingSession[] {
    return this.database
      .prepare(
        `${select} WHERE s.activity_date BETWEEN ? AND ? ${query.characterId ? 'AND s.character_id = ?' : ''} ORDER BY s.activity_date DESC, s.created_at DESC, s.id`
      )
      .all(query.from, query.to, ...(query.characterId ? [query.characterId] : []))
      .map(mapRow)
  }

  find(id: string): HuntingSession | undefined {
    const row = this.database.prepare(`${select} WHERE s.id = ?`).get(id)
    return row ? mapRow(row) : undefined
  }

  insert(session: HuntingSession): void {
    this.database
      .prepare(
        `INSERT INTO hunting_sessions (id, character_id, world_snapshot, activity_date, minutes, mesos, cost, sol_fragments, nodestones, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.characterId,
        session.characterWorld,
        session.date,
        session.minutes,
        session.mesos,
        session.cost,
        session.solFragments,
        session.nodestones,
        session.notes,
        session.createdAt,
        session.updatedAt
      )
  }

  update(session: HuntingSession): void {
    this.database
      .prepare(
        `UPDATE hunting_sessions SET character_id = ?, world_snapshot = ?, activity_date = ?, minutes = ?, mesos = ?, cost = ?, sol_fragments = ?, nodestones = ?, notes = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        session.characterId,
        session.characterWorld,
        session.date,
        session.minutes,
        session.mesos,
        session.cost,
        session.solFragments,
        session.nodestones,
        session.notes,
        session.updatedAt,
        session.id
      )
  }

  remove(id: string): void {
    this.database.prepare('DELETE FROM hunting_sessions WHERE id = ?').run(id)
  }
}
