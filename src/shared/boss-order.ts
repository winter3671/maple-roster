import { WEEKLY_BOSSES } from './boss-catalog'
import { BOSS_DISPLAY_ORDER } from './boss-display-order'

type BossSelection = { bossName: string; difficulty: string }
const key = (boss: BossSelection) => JSON.stringify([boss.bossName, boss.difficulty])
const ranks = new Map(
  BOSS_DISPLAY_ORDER.map(([bossName, difficulty], index) => [key({ bossName, difficulty }), index])
)

// Display order is maintained separately from all prices and party sizes.
export function compareBossProgression(a: BossSelection, b: BossSelection): number {
  const aRank = ranks.get(key(a))
  const bRank = ranks.get(key(b))
  if (aRank !== undefined && bRank !== undefined) return aRank - bRank
  if (aRank === undefined && bRank !== undefined) return 1
  if (aRank !== undefined && bRank === undefined) return -1
  const index = (name: string) => {
    const found = WEEKLY_BOSSES.findIndex((boss) => boss.name === name)
    return found < 0 ? WEEKLY_BOSSES.length : found
  }
  return (
    index(a.bossName) - index(b.bossName) ||
    a.bossName.localeCompare(b.bossName, 'ko') ||
    a.difficulty.localeCompare(b.difficulty, 'ko')
  )
}
