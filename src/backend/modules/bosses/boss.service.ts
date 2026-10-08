import { randomUUID } from 'node:crypto'
import {
  parseBossDetails,
  parseBossPreset,
  parseBossQuery,
  parseCrystal,
  type BossList,
  type BossPreset,
  type BossRun
} from '../../../shared/contracts/boss.contract'
import { AppError } from '../../../shared/errors'
import { readId, readObject, readText } from '../../../shared/validation'
import { getKstDate } from '../../../shared/dates'
import { bossWeek } from '../../../shared/boss-period'
import { summarizeBosses } from '../../domain/boss-profit'
import { UnitOfWork } from '../../database/unit-of-work'
import { CharacterRepository } from '../characters/character.repository'
import { LedgerRepository } from '../ledger/ledger.repository'
import { BossRepository } from './boss.repository'
import { DropRepository } from '../drops/drop.repository'

export class BossService {
  constructor(
    private readonly repository: BossRepository,
    private readonly characters: CharacterRepository,
    private readonly ledger: LedgerRepository,
    private readonly transaction: UnitOfWork,
    private readonly drops: DropRepository,
    private readonly now = () => new Date()
  ) {}
  presets(value?: unknown): BossPreset[] {
    return this.repository.presets(value === undefined ? undefined : readId(value))
  }
  createPreset(value: unknown): BossPreset {
    const input = parseBossPreset(value)
    return this.transaction.run(() => {
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      if (character.isHidden)
        throw new AppError('VALIDATION_ERROR', '숨김을 해제한 뒤 프리셋을 추가해 주세요.')
      const bossKey = input.bossName.toLowerCase()
      if (this.repository.presetByKey(input.characterId, bossKey))
        throw new AppError(
          'DUPLICATE_BOSS',
          '같은 캐릭터에 같은 보스가 이미 있습니다. 기존 프리셋의 난이도를 수정해 주세요.'
        )
      const timestamp = this.now().toISOString()
      const preset = {
        ...input,
        id: randomUUID(),
        bossKey,
        characterName: character.name,
        characterWorld: character.world,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.repository.savePreset(preset)
      return preset
    })
  }
  updatePreset(value: unknown): BossPreset {
    const raw = readObject(value)
    const input = parseBossPreset(raw)
    const current = this.findPreset(readId(raw.id))
    if (input.characterId !== current.characterId || input.bossName !== current.bossName)
      throw new AppError('VALIDATION_ERROR', '보스와 캐릭터를 바꾸려면 새 프리셋을 추가해 주세요.')
    const preset = { ...current, ...input, updatedAt: this.now().toISOString() }
    this.repository.savePreset(preset)
    return preset
  }
  removePreset(value: unknown): null {
    const id = readId(value)
    this.findPreset(id)
    this.repository.removePreset(id)
    return null
  }
  list(value: unknown): BossList {
    const query = parseBossQuery(value)
    const week = bossWeek(query.date)
    const runs = this.repository.list(week, query.characterId)
    return { week, runs, summary: summarizeBosses(runs) }
  }
  generate(value: unknown): BossList {
    const query = parseBossQuery(value)
    const week = bossWeek(query.date)
    if (week > bossWeek(getKstDate(this.now())))
      throw new AppError('VALIDATION_ERROR', '미래 주차는 생성할 수 없습니다.')
    return this.transaction.run(() => {
      const timestamp = this.now().toISOString()
      for (const preset of this.repository.presets(query.characterId)) {
        const character = this.characters.find(preset.characterId)!
        if (character.isHidden) continue
        this.repository.insertRun({
          ...preset,
          id: randomUUID(),
          week,
          isCleared: false,
          notes: '',
          expectedShare: 0,
          settlement: null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
      }
      return this.list(query)
    })
  }
  setClear(value: unknown): BossRun {
    const raw = readObject(value)
    if (typeof raw.isCleared !== 'boolean')
      throw new AppError('VALIDATION_ERROR', '클리어 여부를 확인해 주세요.')
    const current = this.findRun(readId(raw.id))
    if (!raw.isCleared && this.drops.hasLots({ kind: 'boss', id: current.id }))
      throw new AppError('DROP_IN_USE', '드랍 묶음을 정리한 뒤 클리어 체크를 해제해 주세요.')
    if (!raw.isCleared && current.settlement)
      throw new AppError('BOSS_ALREADY_SETTLED', '판매 취소 후 클리어 체크를 해제해 주세요.')
    const run = { ...current, isCleared: raw.isCleared, updatedAt: this.now().toISOString() }
    this.repository.updateRun(run)
    return run
  }
  updateRun(value: unknown): BossRun {
    const raw = readObject(value)
    const current = this.findRun(readId(raw.id))
    if (current.settlement)
      throw new AppError('BOSS_ALREADY_SETTLED', '판매 취소 후 보스 기록을 수정해 주세요.')
    const run = {
      ...current,
      ...parseBossDetails(raw),
      notes: readText(raw.notes ?? '', '메모', 500, false, true),
      updatedAt: this.now().toISOString()
    }
    this.repository.updateRun(run)
    return this.findRun(run.id)
  }
  settle(value: unknown): BossRun {
    const input = parseCrystal(value, getKstDate(this.now()))
    return this.transaction.run(() => {
      const current = this.findRun(input.runId)
      if (!current.isCleared)
        throw new AppError('VALIDATION_ERROR', '클리어 체크 후 결정석 판매를 기록해 주세요.')
      if (input.date < current.week)
        throw new AppError('VALIDATION_ERROR', '판매일은 보스 주차 시작일보다 빠를 수 없습니다.')
      const timestamp = this.now().toISOString()
      this.repository.settle(input, current.settlement?.id ?? randomUUID(), timestamp)
      const run = this.findRun(current.id)
      this.ledger.syncCrystal(run, timestamp)
      return run
    })
  }
  cancelSale(value: unknown): null {
    const id = readId(value)
    return this.transaction.run(() => {
      this.findRun(id)
      this.repository.cancelSettlement(id, this.now().toISOString())
      return null
    })
  }
  removeRun(value: unknown): null {
    const id = readId(value)
    return this.transaction.run(() => {
      const run = this.findRun(id)
      if (this.drops.hasSales({ kind: 'boss', id }))
        throw new AppError('DROP_IN_USE', '드랍 판매를 모두 취소한 뒤 보스 기록을 삭제해 주세요.')
      if (run.settlement)
        throw new AppError('BOSS_ALREADY_SETTLED', '판매 취소 후 보스 기록을 삭제해 주세요.')
      this.repository.removeRun(id)
      return null
    })
  }
  private findPreset(id: string): BossPreset {
    const preset = this.repository.preset(id)
    if (!preset)
      throw new AppError('BOSS_NOT_FOUND', '보스 프리셋을 찾을 수 없습니다. 새로고침해 주세요.')
    return preset
  }
  private findRun(id: string): BossRun {
    const run = this.repository.find(id)
    if (!run)
      throw new AppError('BOSS_NOT_FOUND', '보스 기록을 찾을 수 없습니다. 새로고침해 주세요.')
    return run
  }
}
