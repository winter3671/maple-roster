import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import type { BossPreset, BossRun, CrystalInput } from '../../../shared/contracts/boss.contract'
import { crystalShare } from '../../domain/boss-profit'

type Row = Record<string, SQLOutputValue>
function details(row: Row) {
  return {
    id: String(row.id),
    characterId: String(row.character_id),
    characterName: String(row.character_name),
    characterWorld: String(row.character_world),
    bossKey: String(row.boss_key),
    bossName: String(row.boss_name),
    difficulty: String(row.difficulty),
    partySize: Number(row.party_size),
    crystalPrice: Number(row.crystal_price),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}
function run(row: Row): BossRun {
  return {
    ...details(row),
    characterWorld: String(row.world_snapshot),
    week: String(row.period_start),
    isCleared: row.is_cleared === 1,
    notes: String(row.notes),
    expectedShare: crystalShare(Number(row.crystal_price), Number(row.party_size)),
    settlement:
      row.settlement_id === null
        ? null
        : { id: String(row.settlement_id), date: String(row.sold_on), amount: Number(row.amount) }
  }
}
const presetSelect =
  'SELECT p.*, c.name AS character_name, c.world AS character_world FROM boss_presets p JOIN characters c ON c.id = p.character_id'
const runSelect = `SELECT r.*, c.name AS character_name, c.world AS character_world, s.id AS settlement_id, s.sold_on, s.amount FROM boss_runs r JOIN characters c ON c.id = r.character_id LEFT JOIN crystal_settlements s ON s.boss_run_id = r.id`

export class BossRepository {
  constructor(private readonly database: DatabaseSync) {}
  presets(characterId?: string): BossPreset[] {
    return this.database
      .prepare(
        `${presetSelect} ${characterId ? 'WHERE p.character_id = ?' : ''} ORDER BY c.name, p.boss_name`
      )
      .all(...(characterId ? [characterId] : []))
      .map(details)
  }
  preset(id: string): BossPreset | undefined {
    const row = this.database.prepare(`${presetSelect} WHERE p.id = ?`).get(id)
    return row ? details(row) : undefined
  }
  presetByKey(characterId: string, bossKey: string): BossPreset | undefined {
    const row = this.database
      .prepare(`${presetSelect} WHERE p.character_id = ? AND p.boss_key = ?`)
      .get(characterId, bossKey)
    return row ? details(row) : undefined
  }
  savePreset(p: BossPreset): void {
    this.database
      .prepare(
        `INSERT INTO boss_presets (id, character_id, boss_key, boss_name, difficulty, party_size, crystal_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET difficulty = excluded.difficulty, party_size = excluded.party_size, crystal_price = excluded.crystal_price, updated_at = excluded.updated_at`
      )
      .run(
        p.id,
        p.characterId,
        p.bossKey,
        p.bossName,
        p.difficulty,
        p.partySize,
        p.crystalPrice,
        p.createdAt,
        p.updatedAt
      )
  }
  removePreset(id: string): void {
    this.database.prepare('DELETE FROM boss_presets WHERE id = ?').run(id)
  }
  list(week: string, characterId?: string): BossRun[] {
    return this.database
      .prepare(
        `${runSelect} WHERE r.period_start = ? ${characterId ? 'AND r.character_id = ?' : ''} ORDER BY c.name, r.boss_name`
      )
      .all(week, ...(characterId ? [characterId] : []))
      .map(run)
  }
  find(id: string): BossRun | undefined {
    const row = this.database.prepare(`${runSelect} WHERE r.id = ?`).get(id)
    return row ? run(row) : undefined
  }
  insertRun(r: BossRun): void {
    this.database
      .prepare(
        `INSERT INTO boss_runs (id, character_id, world_snapshot, boss_key, boss_name, difficulty, party_size, crystal_price, period_start, is_cleared, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(character_id, boss_key, period_start) DO NOTHING`
      )
      .run(
        r.id,
        r.characterId,
        r.characterWorld,
        r.bossKey,
        r.bossName,
        r.difficulty,
        r.partySize,
        r.crystalPrice,
        r.week,
        Number(r.isCleared),
        r.notes,
        r.createdAt,
        r.updatedAt
      )
  }
  updateRun(r: BossRun): void {
    this.database
      .prepare(
        'UPDATE boss_runs SET difficulty = ?, party_size = ?, crystal_price = ?, is_cleared = ?, notes = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        r.difficulty,
        r.partySize,
        r.crystalPrice,
        Number(r.isCleared),
        r.notes,
        r.updatedAt,
        r.id
      )
  }
  removeRun(id: string): void {
    this.database.prepare('DELETE FROM boss_runs WHERE id = ?').run(id)
  }
  settle(input: CrystalInput, id: string, timestamp: string): void {
    this.database
      .prepare(
        `INSERT INTO crystal_settlements (id, boss_run_id, sold_on, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(boss_run_id) DO UPDATE SET sold_on = excluded.sold_on, amount = excluded.amount, updated_at = excluded.updated_at`
      )
      .run(id, input.runId, input.date, input.amount, timestamp, timestamp)
    this.database
      .prepare('UPDATE boss_runs SET updated_at = ? WHERE id = ?')
      .run(timestamp, input.runId)
  }
  cancelSettlement(runId: string, timestamp: string): void {
    this.database.prepare('DELETE FROM crystal_settlements WHERE boss_run_id = ?').run(runId)
    this.database.prepare('UPDATE boss_runs SET updated_at = ? WHERE id = ?').run(timestamp, runId)
  }
}
