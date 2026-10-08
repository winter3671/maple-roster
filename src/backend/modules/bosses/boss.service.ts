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
import { getKstDate, readDate } from '../../../shared/dates'
import { bossWeek } from '../../../shared/boss-period'
import {
  validateBossSelection,
  validateBossDifficultyChange,
  validateBossParty
} from '../../../shared/boss-catalog'
import { findCrystalPrice, requireCrystalPrice } from '../../../shared/crystal-prices'
import { summarizeBosses } from '../../domain/boss-profit'
import { crystalShare } from '../../../shared/crystal-prices'
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
    validateBossSelection(input.bossName, input.difficulty)
    validateBossParty(input.bossName, input.difficulty, input.partySize)
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
        crystalPrice: requireCrystalPrice(input.bossName, input.difficulty, getKstDate(this.now())),
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
    validateBossDifficultyChange(current.bossName, input.difficulty, current.difficulty)
    validateBossParty(current.bossName, input.difficulty, input.partySize, current)
    const preset = {
      ...current,
      ...input,
      crystalPrice:
        findCrystalPrice(input.bossName, input.difficulty, getKstDate(this.now()))?.amount ??
        current.crystalPrice,
      updatedAt: this.now().toISOString()
    }
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
      const counts = new Map<string, number>()
      for (const run of this.repository.list(week, query.characterId)) {
        counts.set(run.characterId, (counts.get(run.characterId) ?? 0) + 1)
      }
      const existing = new Set(
        this.repository
          .list(week, query.characterId)
          .map((run) => `${run.characterId}:${run.bossKey}`)
      )
      for (const preset of this.repository.presets(query.characterId)) {
        const character = this.characters.find(preset.characterId)!
        if (character.isHidden) continue
        if (existing.has(`${preset.characterId}:${preset.bossKey}`)) continue
        const count = counts.get(preset.characterId) ?? 0
        if (count >= 12)
          throw new AppError(
            'VALIDATION_ERROR',
            `${character.name}의 주차 보스가 12개를 초과합니다. 현재 기록을 정리한 뒤 생성해 주세요.`
          )
        counts.set(preset.characterId, count + 1)
        this.repository.insertRun({
          ...preset,
          crystalPrice: this.priceForRun(
            preset.bossName,
            preset.difficulty,
            week,
            preset.crystalPrice
          ),
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
    const isCleared = raw.isCleared
    return this.transaction.run(() => {
      const current = this.findRun(readId(raw.id))
      if (!raw.isCleared && this.drops.hasLots({ kind: 'boss', id: current.id }))
        throw new AppError('DROP_IN_USE', '드랍 묶음을 정리한 뒤 클리어 체크를 해제해 주세요.')
      const run = { ...current, isCleared, updatedAt: this.now().toISOString() }
      this.repository.updateRun(run)
      if (!raw.isCleared) this.repository.cancelSettlement(run.id, run.updatedAt)
      else if (!current.settlement) this.syncClearIncome(run, this.defaultIncomeDate(run.week))
      return this.findRun(run.id)
    })
  }
  createRun(value: unknown): BossRun {
    const raw = readObject(value)
    const input = parseBossPreset(raw)
    const week = bossWeek(parseBossQuery(raw).date)
    if (week > bossWeek(getKstDate(this.now())))
      throw new AppError('VALIDATION_ERROR', '미래 주차는 추가할 수 없습니다.')
    validateBossSelection(input.bossName, input.difficulty)
    validateBossParty(input.bossName, input.difficulty, input.partySize)
    return this.transaction.run(() => {
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      if (character.isHidden)
        throw new AppError('VALIDATION_ERROR', '숨김을 해제한 뒤 보스를 추가해 주세요.')
      const existing = this.repository.list(week, character.id)
      if (existing.some((run) => run.bossName === input.bossName))
        throw new AppError('DUPLICATE_BOSS', '이 캐릭터의 주차에 같은 보스가 이미 있습니다.')
      if (existing.length >= 12)
        throw new AppError(
          'VALIDATION_ERROR',
          '한 캐릭터의 주차에는 최대 12개 보스를 추가할 수 있습니다.'
        )
      const timestamp = this.now().toISOString()
      const run: BossRun = {
        ...input,
        crystalPrice: requireCrystalPrice(input.bossName, input.difficulty, week),
        id: randomUUID(),
        bossKey: input.bossName.toLowerCase(),
        characterName: character.name,
        characterWorld: character.world,
        week,
        isCleared: false,
        notes: readText(raw.notes ?? '', '메모', 500, false, true),
        expectedShare: 0,
        settlement: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.repository.insertRun(run)
      return this.findRun(run.id)
    })
  }
  updateRun(value: unknown): BossRun {
    const raw = readObject(value)
    return this.transaction.run(() => {
      const current = this.findRun(readId(raw.id))
      const run = {
        ...current,
        ...parseBossDetails(raw),
        bossName:
          raw.bossName === undefined ? current.bossName : readText(raw.bossName, '보스 이름', 60),
        notes: readText(raw.notes ?? '', '메모', 500, false, true),
        updatedAt: this.now().toISOString()
      }
      const bossChanged = run.bossName !== current.bossName
      if (bossChanged) {
        if (this.drops.hasLots({ kind: 'boss', id: current.id }))
          throw new AppError('DROP_IN_USE', '드랍 묶음을 정리한 뒤 보스를 변경해 주세요.')
        validateBossSelection(run.bossName, run.difficulty)
        if (
          this.repository
            .list(current.week, current.characterId)
            .some((other) => other.id !== run.id && other.bossName === run.bossName)
        )
          throw new AppError('DUPLICATE_BOSS', '이 캐릭터의 주차에 같은 보스가 이미 있습니다.')
      } else validateBossDifficultyChange(current.bossName, run.difficulty, current.difficulty)
      validateBossParty(
        run.bossName,
        run.difficulty,
        run.partySize,
        bossChanged ? undefined : current
      )
      run.bossKey = run.bossName.toLowerCase()
      run.crystalPrice =
        !bossChanged && run.difficulty === current.difficulty
          ? current.crystalPrice
          : this.priceForRun(run.bossName, run.difficulty, current.week, current.crystalPrice)
      this.repository.updateRun(run)
      if (run.isCleared) {
        const date =
          raw.incomeDate === undefined
            ? (current.settlement?.date ?? this.defaultIncomeDate(run.week))
            : readDate(raw.incomeDate)
        if (date < run.week)
          throw new AppError('VALIDATION_ERROR', '수익 반영일은 주차 시작일보다 빠를 수 없습니다.')
        if (date > getKstDate(this.now()))
          throw new AppError('VALIDATION_ERROR', '오늘 이후의 수익은 기록할 수 없습니다.')
        const changed =
          bossChanged ||
          run.difficulty !== current.difficulty ||
          run.partySize !== current.partySize
        const preserve = current.settlement && !changed && !this.repository.isAutomatic(run.id)
        if (preserve) {
          this.repository.settle(
            { runId: run.id, date, amount: current.settlement!.amount },
            current.settlement!.id,
            run.updatedAt,
            false
          )
          this.ledger.syncCrystal(this.findRun(run.id), run.updatedAt)
        } else this.syncClearIncome(run, date)
      }
      return this.findRun(run.id)
    })
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
      this.repository.settle(input, current.settlement?.id ?? randomUUID(), timestamp, false)
      const run = this.findRun(current.id)
      this.ledger.syncCrystal(run, timestamp)
      return run
    })
  }
  cancelSale(value: unknown): null {
    const id = readId(value)
    return this.transaction.run(() => {
      const run = this.findRun(id)
      this.repository.cancelSettlement(id, this.now().toISOString())
      // Legacy API cancellation now means undoing the clear and its income.
      if (this.drops.hasLots({ kind: 'boss', id }))
        throw new AppError('DROP_IN_USE', '드랍 묶음을 정리한 뒤 클리어 체크를 해제해 주세요.')
      this.repository.updateRun({ ...run, isCleared: false, updatedAt: this.now().toISOString() })
      return null
    })
  }
  removeRun(value: unknown): null {
    const id = readId(value)
    return this.transaction.run(() => {
      const run = this.findRun(id)
      if (this.drops.hasSales({ kind: 'boss', id }))
        throw new AppError('DROP_IN_USE', '드랍 판매를 모두 취소한 뒤 보스 기록을 삭제해 주세요.')
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
  private defaultIncomeDate(week: string): string {
    const today = getKstDate(this.now())
    return bossWeek(today) === week ? today : week
  }
  private syncClearIncome(run: BossRun, date: string): void {
    if (date > getKstDate(this.now()))
      throw new AppError('VALIDATION_ERROR', '오늘 이후의 수익은 기록할 수 없습니다.')
    this.repository.settle(
      { runId: run.id, date, amount: crystalShare(run.crystalPrice, run.partySize) },
      run.settlement?.id ?? randomUUID(),
      run.updatedAt,
      true
    )
    this.ledger.syncCrystal(this.findRun(run.id), run.updatedAt)
  }
  private priceForRun(name: string, difficulty: string, week: string, previous: number): number {
    const price = findCrystalPrice(name, difficulty, week)
    if (price) return price.amount
    // Unknown historical names/difficulties keep their stored price. Known selections
    // before the supported price history cannot use today's price silently.
    try {
      validateBossSelection(name, difficulty)
    } catch {
      return previous
    }
    return requireCrystalPrice(name, difficulty, week)
  }
  private findRun(id: string): BossRun {
    const run = this.repository.find(id)
    if (!run)
      throw new AppError('BOSS_NOT_FOUND', '보스 기록을 찾을 수 없습니다. 새로고침해 주세요.')
    return run
  }
}
