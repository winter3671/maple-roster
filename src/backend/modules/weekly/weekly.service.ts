import type { WeeklyOverview, WeeklyCharacter } from '../../../shared/contracts/weekly.contract'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import { getKstDate } from '../../../shared/dates'
import { AppError } from '../../../shared/errors'
import type { Character } from '../../../shared/contracts/character.contract'
import type { NexonClient } from '../../integrations/nexon/nexon.client'

export class WeeklyService {
  private snapshots = new Map<
    string,
    { ocid: string; row: Pick<WeeklyCharacter, 'contents' | 'fetchedAt' | 'error'> }
  >()
  private week = ''
  private running?: Promise<WeeklyOverview>
  constructor(
    private readonly client: Pick<NexonClient, 'weeklyContents'>,
    private readonly characters: { list(): Character[] },
    private readonly now = () => new Date()
  ) {}
  list(): WeeklyOverview {
    const week = bossWeek(getKstDate(this.now()))
    if (this.week !== week) {
      this.week = week
      this.snapshots.clear()
    }
    const characters = this.characters.list()
    const ids = new Set(characters.map((character) => character.id))
    for (const id of this.snapshots.keys()) if (!ids.has(id)) this.snapshots.delete(id)
    return {
      week,
      end: shiftDate(week, 6),
      characters: characters.map((character) => ({
        characterId: character.id,
        name: character.name,
        world: character.world,
        isHidden: character.isHidden,
        connected: !!character.nexon,
        ...(character.nexon && this.snapshots.get(character.id)?.ocid === character.nexon.ocid
          ? this.snapshots.get(character.id)!.row
          : {})
      }))
    }
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
          this.snapshots.set(character.id, { ocid, row: { error: `미조회: ${stopped}` } })
          continue
        }
        const contents = await this.client.weeklyContents(ocid, today)
        if (bossWeek(getKstDate(this.now())) !== start.week) break
        this.snapshots.set(character.id, {
          ocid,
          row: { contents, fetchedAt: this.now().toISOString() }
        })
      } catch (caught) {
        const message =
          caught instanceof AppError ? caught.message : '주간 콘텐츠를 조회하지 못했습니다.'
        this.snapshots.set(character.id, { ocid, row: { error: message } })
        if (
          caught instanceof AppError &&
          ['API_KEY_MISSING', 'API_KEY_INVALID', 'API_RATE_LIMITED', 'API_NETWORK_ERROR'].includes(
            caught.code
          )
        )
          stopped = message
      }
    }
    return this.list()
  }
}
