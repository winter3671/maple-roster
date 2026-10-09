import type { WeeklyOverview, WeeklyPeriod } from '../../../shared/contracts/weekly.contract'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import { getKstDate } from '../../../shared/dates'
import { AppError } from '../../../shared/errors'
import type { Character } from '../../../shared/contracts/character.contract'
import type { NexonClient } from '../../integrations/nexon/nexon.client'
import { MemoryWeeklyStore, type WeeklyStore } from './weekly.repository'
import { guildContent } from '../../../shared/weekly-content'
export class WeeklyService {
  private errors = new Map<string, { ocid: string; message: string }>()
  private week = ''
  private running?: Promise<WeeklyOverview>
  constructor(
    private readonly client: Pick<NexonClient, 'weeklyContents'>,
    private readonly characters: { list(): Character[] },
    private readonly now = () => new Date(),
    private readonly store: WeeklyStore = new MemoryWeeklyStore()
  ) {
    this.list()
  }
  list(): WeeklyOverview {
    const week = bossWeek(getKstDate(this.now())),
      previous = shiftDate(week, -7)
    if (this.week !== week) {
      this.week = week
      this.errors.clear()
    }
    const characters = this.characters.list()
    this.store.prune(
      week,
      previous,
      characters.map((row) => row.id)
    )
    const period = (start: string): WeeklyPeriod => ({
      week: start,
      end: shiftDate(start, 6),
      characters: characters.map((character) => {
        const snapshot = this.store.get(character.id, start)
        const error = start === week ? this.errors.get(character.id) : undefined
        return {
          characterId: character.id,
          name: character.name,
          world: character.world,
          connected: !!character.nexon,
          ...(character.nexon && snapshot?.ocid === character.nexon.ocid
            ? { contents: snapshot.contents, fetchedAt: snapshot.fetchedAt }
            : {}),
          ...(character.nexon && error?.ocid === character.nexon.ocid
            ? { error: error.message }
            : {})
        }
      })
    })
    return { ...period(week), previous: period(previous) }
  }
  sync(): Promise<WeeklyOverview> {
    if (this.running) return this.running
    this.running = this.refresh().finally(() => {
      this.running = undefined
    })
    return this.running
  }
  private async refresh(): Promise<WeeklyOverview> {
    const start = this.list(),
      today = getKstDate(this.now())
    let stopped: string | undefined
    for (const character of this.characters.list()) {
      if (!character.nexon) continue
      const ocid = character.nexon.ocid
      try {
        if (stopped) {
          this.errors.set(character.id, { ocid, message: `미조회: ${stopped}` })
          continue
        }
        const result = await this.client.weeklyContents(ocid, today)
        if (bossWeek(getKstDate(this.now())) !== start.week) break
        if (this.characters.list().find((row) => row.id === character.id)?.nexon?.ocid !== ocid)
          continue
        const contents = ['suro', 'flag'].flatMap((kind) => {
          const content = guildContent(result, kind as 'suro' | 'flag')
          return content ? [content] : []
        })
        this.store.set(character.id, start.week, {
          ocid,
          contents,
          fetchedAt: this.now().toISOString()
        })
        this.errors.delete(character.id)
      } catch (caught) {
        this.errors.set(character.id, {
          ocid,
          message:
            caught instanceof AppError ? caught.message : '주간 콘텐츠를 조회하지 못했습니다.'
        })
        if (
          caught instanceof AppError &&
          ['API_KEY_MISSING', 'API_KEY_INVALID', 'API_RATE_LIMITED', 'API_NETWORK_ERROR'].includes(
            caught.code
          )
        )
          stopped = caught.message
      }
    }
    return this.list()
  }
}
