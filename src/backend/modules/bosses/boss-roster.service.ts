import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors'
import { readId, readObject, readText } from '../../../shared/validation'
import {
  parseBossMembers,
  type BossMember,
  type BossRosterState,
  type BossTemplate
} from '../../../shared/contracts/boss-roster.contract'
import {
  validateBossSelection,
  validateBossDifficultyChange,
  validateBossParty
} from '../../../shared/boss-catalog'
import { findCrystalPrice, requireCrystalPrice } from '../../../shared/crystal-prices'
import { getKstDate } from '../../../shared/dates'
import { UnitOfWork } from '../../database/unit-of-work'
import { BossRepository } from './boss.repository'
import { CharacterRepository } from '../characters/character.repository'

export class BossRosterService {
  constructor(
    private readonly db: DatabaseSync,
    private readonly bosses: BossRepository,
    private readonly characters: CharacterRepository,
    private readonly transaction: UnitOfWork,
    private readonly now = () => new Date()
  ) {}
  state(): BossRosterState {
    const templates = this.db
      .prepare('SELECT * FROM boss_templates ORDER BY name, id')
      .all()
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        members: JSON.parse(String(row.members_json)) as BossMember[]
      }))
    const assignments = this.db.prepare('SELECT * FROM boss_roster_assignments').all()
    const presets = this.bosses.presets()
    // Legacy endpoints can still create per-character rows; expose those as a roster too.
    const ids = new Set([
      ...assignments.map((row) => String(row.character_id)),
      ...presets.map((row) => row.characterId)
    ])
    const rosters = [...ids].map((characterId) => {
      const meta = assignments.find((row) => row.character_id === characterId)
      return {
        characterId,
        templateId: meta?.template_id ? String(meta.template_id) : null,
        name: String(meta?.name ?? '기존 보스 구성'),
        customized: meta ? Boolean(meta.customized) : true,
        members: presets
          .filter((row) => row.characterId === characterId)
          .map(({ bossName, difficulty, partySize }) => ({ bossName, difficulty, partySize }))
      }
    })
    return { templates, rosters }
  }
  saveTemplate(value: unknown): BossTemplate {
    const raw = readObject(value)
    const id = raw.id === undefined ? randomUUID() : readId(raw.id)
    const previous = raw.id === undefined ? undefined : this.template(id)
    const name = readText(raw.name, '프리셋 이름', 50)
    const members = parseBossMembers(raw.members)
    this.validate(members, previous?.members)
    this.db
      .prepare(
        'INSERT INTO boss_templates(id, name, members_json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, members_json=excluded.members_json'
      )
      .run(id, name, JSON.stringify(members))
    return { id, name, members }
  }
  removeTemplate(value: unknown): null {
    const id = readId(value)
    this.template(id)
    this.db.prepare('DELETE FROM boss_templates WHERE id=?').run(id)
    return null
  }
  assign(value: unknown): null {
    const raw = readObject(value)
    if (
      !Array.isArray(raw.characterIds) ||
      !raw.characterIds.length ||
      raw.characterIds.length > 100
    )
      throw new AppError('VALIDATION_ERROR', '할당할 캐릭터를 선택해 주세요.')
    const ids = raw.characterIds.map(readId)
    if (new Set(ids).size !== ids.length)
      throw new AppError('VALIDATION_ERROR', '캐릭터 선택이 중복되었습니다.')
    return this.transaction.run(() => {
      const template = this.template(readId(raw.templateId))
      for (const id of ids) {
        this.replace(id, template.members)
        this.metadata(id, template.id, template.name, false)
      }
      return null
    })
  }
  saveRoster(value: unknown): null {
    const raw = readObject(value)
    const id = readId(raw.characterId)
    const members = parseBossMembers(raw.members)
    return this.transaction.run(() => {
      this.validate(members, this.bosses.presets(id))
      this.replace(id, members)
      const meta = this.db
        .prepare('SELECT * FROM boss_roster_assignments WHERE character_id=?')
        .get(id)
      this.metadata(
        id,
        meta?.template_id ? String(meta.template_id) : null,
        String(meta?.name ?? '개별 보스 구성'),
        true
      )
      return null
    })
  }
  private validate(members: BossMember[], previous: BossMember[] = []): void {
    for (const row of members) {
      const old = previous.find((entry) => entry.bossName === row.bossName)
      if (old) validateBossDifficultyChange(row.bossName, row.difficulty, old.difficulty)
      else validateBossSelection(row.bossName, row.difficulty)
      validateBossParty(row.bossName, row.difficulty, row.partySize, old)
    }
  }
  private replace(characterId: string, members: BossMember[]): void {
    const character = this.characters.find(characterId)
    if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
    if (character.isHidden)
      throw new AppError('VALIDATION_ERROR', '숨김을 해제한 뒤 보스 구성을 변경해 주세요.')
    const previous = this.bosses.presets(characterId)
    const timestamp = this.now().toISOString()
    // Weekly run snapshots have no FK to these planning rows and remain untouched.
    this.db.prepare('DELETE FROM boss_presets WHERE character_id=?').run(characterId)
    for (const member of members) {
      const old = previous.find((row) => row.bossName === member.bossName)
      const crystalPrice =
        findCrystalPrice(member.bossName, member.difficulty, getKstDate(this.now()))?.amount ??
        old?.crystalPrice ??
        requireCrystalPrice(member.bossName, member.difficulty, getKstDate(this.now()))
      this.bosses.savePreset({
        ...member,
        characterId,
        crystalPrice,
        id: old?.id ?? randomUUID(),
        bossKey: member.bossName.toLowerCase(),
        characterName: character.name,
        characterWorld: character.world,
        createdAt: old?.createdAt ?? timestamp,
        updatedAt: timestamp
      })
    }
  }
  private metadata(id: string, templateId: string | null, name: string, customized: boolean): void {
    this.db
      .prepare(
        'INSERT INTO boss_roster_assignments(character_id, template_id, name, customized) VALUES (?, ?, ?, ?) ON CONFLICT(character_id) DO UPDATE SET template_id=excluded.template_id, name=excluded.name, customized=excluded.customized'
      )
      .run(id, templateId, name, Number(customized))
  }
  private template(id: string): BossTemplate {
    const row = this.db.prepare('SELECT * FROM boss_templates WHERE id=?').get(id)
    if (!row) throw new AppError('BOSS_NOT_FOUND', '보스 묶음 프리셋을 찾을 수 없습니다.')
    return { id, name: String(row.name), members: JSON.parse(String(row.members_json)) }
  }
}
