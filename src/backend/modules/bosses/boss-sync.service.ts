import { randomUUID } from 'node:crypto'
import type { BossRun } from '../../../shared/contracts/boss.contract'
import { parseBossQuery } from '../../../shared/contracts/boss.contract'
import type { BossSyncPreview } from '../../../shared/contracts/boss-sync.contract'
import { getKstDate, readDate } from '../../../shared/dates'
import { compareBossProgression } from '../../../shared/boss-order'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import { readId, readObject } from '../../../shared/validation'
import { AppError } from '../../../shared/errors'
import { NexonClient } from '../../integrations/nexon/nexon.client'
import { CharacterRepository } from '../characters/character.repository'
import { BossService } from './boss.service'

export class BossSyncService {
  private readonly previews = new Map<
    string,
    { preview: BossSyncPreview; snapshots: BossRun[]; characterId: string; ocid: string }
  >()
  constructor(
    private readonly client: NexonClient,
    private readonly characters: CharacterRepository,
    private readonly bosses: BossService,
    private readonly now = () => new Date()
  ) {}
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
        .map(({ bossName, difficulty }) => ({ bossName, difficulty }))
    }
    for (const [id, entry] of this.previews)
      if (entry.preview.expiresAt <= this.now().toISOString()) this.previews.delete(id)
    while (this.previews.size >= 50) this.previews.delete(this.previews.keys().next().value!)
    this.previews.set(preview.id, { preview, snapshots, characterId, ocid: character.nexon.ocid })
    return preview
  }
  apply(value: unknown): { applied: number; alreadyCleared: number } {
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
