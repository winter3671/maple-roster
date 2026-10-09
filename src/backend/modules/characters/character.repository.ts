import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import type { Character } from '../../../shared/contracts/character.contract'
import type { NexonProfile } from '../../../shared/contracts/nexon.contract'
import { characterImageUrl } from '../../../shared/character-image'

function mapRow(row: Record<string, SQLOutputValue>): Character {
  return {
    id: String(row.id),
    name: String(row.name),
    world: String(row.world),
    notes: String(row.notes),
    isHidden: row.is_hidden === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.nexon_ocid
      ? {
          nexon: {
            ocid: String(row.nexon_ocid),
            profile: row.nexon_fetched_at
              ? {
                  level: Number(row.nexon_level),
                  job: String(row.nexon_job),
                  guild: String(row.nexon_guild),
                  imageUrl: characterImageUrl(row.nexon_image_url),
                  fetchedAt: String(row.nexon_fetched_at)
                }
              : null
          }
        }
      : {})
  }
}

export function characterIdentity(name: string, world: string): string {
  return JSON.stringify([name.toLowerCase(), world.toLowerCase()])
}

export class CharacterRepository {
  private readonly supportsProfiles: boolean
  private readonly supportsImages: boolean
  constructor(
    private readonly database: DatabaseSync,
    private readonly now: () => Date = () => new Date()
  ) {
    this.supportsProfiles = database
      .prepare('PRAGMA table_info(characters)')
      .all()
      .some((row) => row.name === 'nexon_ocid')
    this.supportsImages = database
      .prepare('PRAGMA table_info(characters)')
      .all()
      .some((row) => row.name === 'nexon_image_url')
  }
  private expireProfiles(): void {
    if (!this.supportsProfiles) return
    const before = new Date(this.now().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    this.database
      .prepare(
        `UPDATE characters SET nexon_level=NULL, nexon_job=NULL, nexon_guild=NULL, nexon_fetched_at=NULL${this.supportsImages ? ', nexon_image_url=NULL' : ''} WHERE nexon_fetched_at <= ?`
      )
      .run(before)
  }

  list(): Character[] {
    this.expireProfiles()
    return this.database
      .prepare('SELECT * FROM characters ORDER BY created_at, id')
      .all()
      .map(mapRow)
  }

  find(id: string): Character | undefined {
    this.expireProfiles()
    const row = this.database.prepare('SELECT * FROM characters WHERE id = ?').get(id)
    return row ? mapRow(row) : undefined
  }

  findByIdentity(name: string, world: string): Character | undefined {
    this.expireProfiles()
    const row = this.database
      .prepare('SELECT * FROM characters WHERE identity_key = ?')
      .get(characterIdentity(name, world))
    return row ? mapRow(row) : undefined
  }
  findByOcid(ocid: string): Character | undefined {
    this.expireProfiles()
    const row = this.database.prepare('SELECT * FROM characters WHERE nexon_ocid = ?').get(ocid)
    return row ? mapRow(row) : undefined
  }
  saveProfile(id: string, profile: NexonProfile): void {
    this.database
      .prepare(
        `UPDATE characters SET name=?, world=?, identity_key=?, nexon_ocid=?, nexon_level=?, nexon_job=?, nexon_guild=?, nexon_fetched_at=?, updated_at=?${this.supportsImages ? ', nexon_image_url=?' : ''} WHERE id=?`
      )
      .run(
        profile.name,
        profile.world,
        characterIdentity(profile.name, profile.world),
        profile.ocid,
        profile.level,
        profile.job,
        profile.guild,
        profile.fetchedAt,
        profile.fetchedAt,
        ...(this.supportsImages ? [characterImageUrl(profile.imageUrl)] : []),
        id
      )
  }
  unlink(id: string): void {
    this.database
      .prepare(
        `UPDATE characters SET nexon_ocid=NULL, nexon_level=NULL, nexon_job=NULL, nexon_guild=NULL, nexon_fetched_at=NULL${this.supportsImages ? ', nexon_image_url=NULL' : ''} WHERE id=?`
      )
      .run(id)
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
    // Retired presets must not prevent deletion; ledger constraints still protect records.
    this.database.exec('SAVEPOINT remove_character')
    try {
      this.database.prepare('DELETE FROM boss_presets WHERE character_id = ?').run(id)
      this.database.prepare('DELETE FROM characters WHERE id = ?').run(id)
      this.database.exec('RELEASE remove_character')
    } catch (error) {
      this.database.exec('ROLLBACK TO remove_character; RELEASE remove_character')
      throw error
    }
  }
}
