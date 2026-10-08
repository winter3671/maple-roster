import { randomUUID } from 'node:crypto'
import type { BossRun } from '../../../shared/contracts/boss.contract'
import { parseBossQuery } from '../../../shared/contracts/boss.contract'
import type {
  BossSyncPreview,
  BossBatchSyncResult
} from '../../../shared/contracts/boss-sync.contract'
import { getKstDate, readDate } from '../../../shared/dates'
import { compareBossProgression } from '../../../shared/boss-order'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import { readId, readObject } from '../../../shared/validation'
import { AppError } from '../../../shared/errors'
import { NexonClient } from '../../integrations/nexon/nexon.client'
import { CharacterRepository } from '../characters/character.repository'
import { BossService } from './boss.service'
import { WEEKLY_BOSSES, bossPartyLimit, validateBossSelection } from '../../../shared/boss-catalog'
import { crystalShare, findCrystalPrice } from '../../../shared/crystal-prices'
import type { CrystalPriceEntry } from '../../../shared/contracts/crystal-price.contract'

export class BossSyncService {
  private batchRunning = false
  private readonly previews = new Map<
    string,
    { preview: BossSyncPreview; snapshots: BossRun[]; characterId: string; ocid: string }
  >()
  constructor(
    private readonly client: NexonClient,
    private readonly characters: CharacterRepository,
    private readonly bosses: BossService,
    private readonly now = () => new Date(),
    private readonly priceHistory: () => CrystalPriceEntry[] = () => []
  ) {}
  invalidatePreviews(): void {
    this.previews.clear()
  }
  async syncAll(value: unknown): Promise<BossBatchSyncResult> {
    if (this.batchRunning)
      throw new AppError(
        'REQUEST_CONFLICT',
        'API 일괄 확인이 진행 중입니다. 완료 후 다시 시도해 주세요.'
      )
    const input = readObject(value)
    const today = getKstDate(this.now()),
      week = bossWeek(readDate(input.date))
    if (week > bossWeek(today))
      throw new AppError('VALIDATION_ERROR', '미래 주차는 조회할 수 없습니다.')
    const queriedDate = week === bossWeek(today) ? today : shiftDate(week, 6)
    if (queriedDate < shiftDate(today, -14))
      throw new AppError('VALIDATION_ERROR', '스케줄러 조회 범위인 최근 14일을 벗어난 주차입니다.')
    const result: BossBatchSyncResult = {
      week,
      queriedDate,
      incomeDate: week === bossWeek(today) ? today : week,
      items: []
    }
    const characters = this.characters.list()
    let interruption: { code: AppError['code']; message: string } | undefined
    this.batchRunning = true
    try {
      for (const character of characters) {
        const identity = {
          characterId: character.id,
          characterName: character.name,
          characterWorld: character.world
        }
        if (!character.nexon) {
          result.items.push({ ...identity, status: 'unlinked' })
          continue
        }
        if (interruption) {
          result.items.push({ ...identity, status: 'notAttempted', error: interruption })
          continue
        }
        try {
          const snapshots = this.bosses.list({ date: week, characterId: character.id }).runs
          const state = await this.client.scheduler(character.nexon.ocid, queriedDate, today)
          if (this.characters.find(character.id)?.nexon?.ocid !== character.nexon.ocid)
            throw new AppError(
              'REQUEST_CONFLICT',
              '조회 중 API 연결이 변경되었습니다. 다시 확인해 주세요.'
            )
          if (week === bossWeek(today) && bossWeek(getKstDate(this.now())) !== week)
            throw new AppError(
              'REQUEST_CONFLICT',
              '목요일 00시가 지나 주차가 바뀌었습니다. 이번 주로 이동해 다시 확인하세요.'
            )
          const applied = this.bosses.syncApiClears(
            snapshots,
            character.id,
            week,
            state.bosses.filter((boss) => boss.isCleared),
            result.incomeDate
          )
          result.items.push({ ...identity, status: 'synced', ...applied })
        } catch (caught) {
          const error =
            caught instanceof AppError
              ? { code: caught.code, message: caught.message }
              : {
                  code: 'DATABASE_ERROR' as const,
                  message: '보스 기록을 저장하지 못했습니다. 이 캐릭터의 기존 기록은 유지됩니다.'
                }
          result.items.push({ ...identity, status: 'failed', error })
          if (
            [
              'API_KEY_MISSING',
              'API_KEY_INVALID',
              'API_RATE_LIMITED',
              'API_NETWORK_ERROR'
            ].includes(error.code)
          )
            interruption = error
        }
      }
      return result
    } finally {
      this.batchRunning = false
    }
  }
  async preview(value: unknown): Promise<BossSyncPreview> {
    const query = parseBossQuery(value)
    const characterId = readId(query.characterId)
    const character = this.characters.find(characterId)
    if (!character?.nexon)
      throw new AppError('VALIDATION_ERROR', '캐릭터 관리에서 API 연결을 먼저 해 주세요.')
    const today = getKstDate(this.now()),
      week = bossWeek(query.date)
    if (week > bossWeek(today))
      throw new AppError('VALIDATION_ERROR', '미래 주차는 조회할 수 없습니다.')
    const queriedDate = week === bossWeek(today) ? today : shiftDate(week, 6)
    if (queriedDate < shiftDate(today, -14))
      throw new AppError('VALIDATION_ERROR', '스케줄러 조회 범위인 최근 14일을 벗어난 주차입니다.')
    const snapshots = this.bosses.list({ ...query, characterId }).runs.sort(compareBossProgression)
    if (!snapshots.length)
      throw new AppError('VALIDATION_ERROR', '이 캐릭터의 주차 보스 기록을 먼저 생성해 주세요.')
    const state = await this.client.scheduler(character.nexon.ocid, queriedDate, today)
    const key = (name: string) => name.normalize('NFC').replace(/\s/g, '').toLowerCase()
    const completed = state.bosses.filter((boss) => boss.isCleared)
    const blockedReasons: string[] = []
    const presets = this.bosses.presets(characterId)
    const members = completed
      .map((boss) => {
        const catalog = WEEKLY_BOSSES.find(
          (candidate) => key(candidate.name) === key(boss.bossName)
        )
        const bossName = catalog?.name ?? boss.bossName
        try {
          validateBossSelection(bossName, boss.difficulty)
        } catch {
          blockedReasons.push(`${bossName} · ${boss.difficulty}: 지원하지 않는 보스·난이도입니다.`)
        }
        const existing = snapshots.find((run) => key(run.bossName) === key(bossName))
        const preset = presets.find((run) => key(run.bossName) === key(bossName))
        const partySize =
          existing?.isCleared && existing.difficulty === boss.difficulty
            ? existing.partySize
            : Math.min(
                existing?.partySize ?? preset?.partySize ?? 1,
                bossPartyLimit(bossName, boss.difficulty)
              )
        const crystalPrice =
          existing?.difficulty === boss.difficulty
            ? existing.crystalPrice
            : findCrystalPrice(bossName, boss.difficulty, week, this.priceHistory())?.amount
        if (crystalPrice === undefined)
          blockedReasons.push(`${bossName} · ${boss.difficulty}: 해당 주차의 가격표가 없습니다.`)
        return {
          bossName,
          difficulty: boss.difficulty,
          partySize,
          crystalPrice: crystalPrice ?? 0,
          expectedShare: crystalShare(crystalPrice ?? 0, partySize),
          isCleared: existing?.isCleared === true
        }
      })
      .sort(compareBossProgression)
    if (!members.length) blockedReasons.push('API 완료 보스가 없습니다. 기존 구성을 유지합니다.')
    if (members.length > 12)
      blockedReasons.push('API 완료 보스가 12개를 초과해 주차 구성으로 반영할 수 없습니다.')
    if (new Set(members.map((boss) => key(boss.bossName))).size !== members.length)
      blockedReasons.push('같은 보스의 여러 완료 난이도가 있어 확인이 필요합니다.')
    const removed = snapshots.filter(
      (run) => !members.some((boss) => key(boss.bossName) === key(run.bossName))
    )
    blockedReasons.push(...this.bosses.apiReplacementConflicts(snapshots, members))
    const preview: BossSyncPreview = {
      id: randomUUID(),
      characterName: character.name,
      characterWorld: character.world,
      week,
      queriedDate,
      incomeDate: week === bossWeek(today) ? today : week,
      expiresAt: new Date(this.now().getTime() + 5 * 60 * 1000).toISOString(),
      rows: snapshots.map((run) => {
        const matching = state.bosses.find(
          (boss) => key(boss.bossName) === key(run.bossName) && boss.difficulty === run.difficulty
        )
        const mismatched = state.bosses.some(
          (boss) =>
            key(boss.bossName) === key(run.bossName) &&
            boss.isCleared &&
            boss.difficulty !== run.difficulty
        )
        return {
          runId: run.id,
          bossName: run.bossName,
          difficulty: run.difficulty,
          partySize: run.partySize,
          expectedShare: run.expectedShare,
          state: run.isCleared
            ? 'alreadyCleared'
            : matching?.isCleared
              ? 'ready'
              : mismatched
                ? 'difficultyMismatch'
                : matching
                  ? 'incomplete'
                  : 'missing'
        }
      }),
      unmatchedClears: state.bosses
        .filter(
          (boss) =>
            boss.isCleared &&
            !snapshots.some(
              (run) =>
                key(run.bossName) === key(boss.bossName) && run.difficulty === boss.difficulty
            )
        )
        .map(({ bossName, difficulty }) => ({ bossName, difficulty })),
      replacement: {
        members,
        removed: removed.map(({ bossName, difficulty }) => ({ bossName, difficulty })),
        blockedReasons
      }
    }
    for (const [id, entry] of this.previews)
      if (entry.preview.expiresAt <= this.now().toISOString()) this.previews.delete(id)
    while (this.previews.size >= 50) this.previews.delete(this.previews.keys().next().value!)
    this.previews.set(preview.id, { preview, snapshots, characterId, ocid: character.nexon.ocid })
    return preview
  }
  apply(value: unknown): {
    applied: number
    alreadyCleared: number
    added?: number
    removed?: number
  } {
    const input = readObject(value),
      id = readId(input.previewId)
    const entry = this.previews.get(id)
    if (!entry || entry.preview.expiresAt <= this.now().toISOString()) {
      this.previews.delete(id)
      throw new AppError(
        'REQUEST_CONFLICT',
        '조회 결과가 만료되었습니다. API 클리어를 다시 조회해 주세요.'
      )
    }
    if (this.characters.find(entry.characterId)?.nexon?.ocid !== entry.ocid)
      throw new AppError(
        'REQUEST_CONFLICT',
        'API 연결이 변경되었습니다. 다시 연결하고 조회해 주세요.'
      )
    if (input.mode === 'replace') {
      if (entry.preview.replacement.blockedReasons.length)
        throw new AppError('REQUEST_CONFLICT', entry.preview.replacement.blockedReasons.join('\n'))
      if (
        !Array.isArray(input.members) ||
        input.members.length !== entry.preview.replacement.members.length
      )
        throw new AppError('VALIDATION_ERROR', 'API 완료 목록 전체를 반영해 주세요.')
      const members = input.members.map((value) => {
        const member = readObject(value)
        const expected = entry.preview.replacement.members.find(
          (row) => row.bossName === member.bossName && row.difficulty === member.difficulty
        )
        if (!expected)
          throw new AppError('VALIDATION_ERROR', 'API에서 완료를 확인한 보스만 반영할 수 있습니다.')
        return {
          bossName: expected.bossName,
          difficulty: expected.difficulty,
          partySize: member.partySize as number
        }
      })
      if (new Set(members.map((row) => row.bossName)).size !== members.length)
        throw new AppError('VALIDATION_ERROR', '중복 보스는 반영할 수 없습니다.')
      const result = this.bosses.replaceApiClears(
        entry.snapshots,
        entry.characterId,
        entry.preview.week,
        members,
        readDate(input.incomeDate ?? entry.preview.incomeDate)
      )
      this.previews.delete(id)
      return result
    }
    if (input.mode !== undefined && input.mode !== 'selected')
      throw new AppError('VALIDATION_ERROR', '반영 방식을 확인해 주세요.')
    if (!Array.isArray(input.runIds) || input.runIds.length < 1 || input.runIds.length > 12)
      throw new AppError('VALIDATION_ERROR', '반영할 보스를 1~12개 선택해 주세요.')
    const ids = [...new Set(input.runIds.map(readId))]
    if (
      ids.some(
        (runId) => !entry.preview.rows.some((row) => row.runId === runId && row.state === 'ready')
      )
    )
      throw new AppError('VALIDATION_ERROR', 'API에서 완료를 확인한 보스만 반영할 수 있습니다.')
    const result = this.bosses.applyApiClears(
      entry.snapshots.filter((run) => ids.includes(run.id)),
      readDate(input.incomeDate ?? entry.preview.incomeDate)
    )
    this.previews.delete(id)
    return result
  }
}
