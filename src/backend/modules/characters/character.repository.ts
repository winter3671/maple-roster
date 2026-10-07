import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import type { Character } from '../../../shared/contracts/character.contract'

function mapRow(row: Record<string, SQLOutputValue>): Character {
  return {
    id: String(row.id),
    name: String(row.name),
    world: String(row.world),
    notes: String(row.notes),
    isHidden: row.is_hidden === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function characterIdentity(name: string, world: string): string {
  return JSON.stringify([name.toLowerCase(), world.toLowerCase()])
}

export class CharacterRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(): Character[] {
    return this.database
      .prepare('SELECT * FROM characters ORDER BY created_at, id')
      .all()
      .map(mapRow)
  }

  find(id: string): Character | undefined {
    const row = this.database.prepare('SELECT * FROM characters WHERE id = ?').get(id)
    return row ? mapRow(row) : undefined
  }

  findByIdentity(name: string, world: string): Character | undefined {
    const row = this.database
      .prepare('SELECT * FROM characters WHERE identity_key = ?')
      .get(characterIdentity(name, world))
    return row ? mapRow(row) : undefined
  }

  insert(character: Character): void {
    this.database
      .prepare(
        `INSERT INTO characters (id, name, world, identity_key, notes, is_hidden, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        character.id,
        character.name,
        character.world,
        characterIdentity(character.name, character.world),
        character.notes,
        Number(character.isHidden),
        character.createdAt,
        character.updatedAt
      )
  }

  update(character: Character): void {
    this.database
      .prepare(
        `UPDATE characters SET name = ?, world = ?, identity_key = ?, notes = ?, is_hidden = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        character.name,
        character.world,
        characterIdentity(character.name, character.world),
        character.notes,
        Number(character.isHidden),
        character.updatedAt,
        character.id
      )
  }

  remove(id: string): void {
    this.database.prepare('DELETE FROM characters WHERE id = ?').run(id)
  }
}
