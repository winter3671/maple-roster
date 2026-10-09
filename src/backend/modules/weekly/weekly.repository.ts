import type { DatabaseSync } from 'node:sqlite'
import type { WeeklyContent } from '../../../shared/contracts/weekly.contract'
export interface WeeklySnapshot {
  ocid: string
  contents: WeeklyContent[]
  fetchedAt: string
}
export interface WeeklyStore {
  get(characterId: string, week: string): WeeklySnapshot | undefined
  set(characterId: string, week: string, snapshot: WeeklySnapshot): void
  prune(currentWeek: string, previousWeek: string, ids: string[]): void
}
export class WeeklyRepository implements WeeklyStore {
  constructor(private readonly db: DatabaseSync) {}
  get(characterId: string, week: string): WeeklySnapshot | undefined {
    const row = this.db
      .prepare('SELECT * FROM weekly_content_snapshots WHERE character_id=? AND week=?')
      .get(characterId, week)
    return row
      ? {
          ocid: String(row.ocid),
          contents: JSON.parse(String(row.contents_json)),
          fetchedAt: String(row.fetched_at)
        }
      : undefined
  }
  set(characterId: string, week: string, snapshot: WeeklySnapshot): void {
    this.db
      .prepare(
        'INSERT INTO weekly_content_snapshots(character_id, week, ocid, contents_json, fetched_at) VALUES (?,?,?,?,?) ON CONFLICT(character_id, week) DO UPDATE SET ocid=excluded.ocid, contents_json=excluded.contents_json, fetched_at=excluded.fetched_at'
      )
      .run(characterId, week, snapshot.ocid, JSON.stringify(snapshot.contents), snapshot.fetchedAt)
  }
  prune(currentWeek: string, previousWeek: string): void {
    this.db
      .prepare('DELETE FROM weekly_content_snapshots WHERE week NOT IN (?,?)')
      .run(currentWeek, previousWeek)
  }
}
export class MemoryWeeklyStore implements WeeklyStore {
  private rows = new Map<string, { characterId: string; week: string; snapshot: WeeklySnapshot }>()
  get(id: string, week: string) {
    return this.rows.get(`${id}:${week}`)?.snapshot
  }
  set(id: string, week: string, snapshot: WeeklySnapshot) {
    this.rows.set(`${id}:${week}`, { characterId: id, week, snapshot })
  }
  prune(current: string, previous: string, ids: string[]) {
    for (const [key, row] of this.rows)
      if (!ids.includes(row.characterId) || ![current, previous].includes(row.week))
        this.rows.delete(key)
  }
}
