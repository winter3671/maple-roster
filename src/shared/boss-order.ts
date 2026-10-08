import { WEEKLY_BOSSES } from './boss-catalog'
import { CRYSTAL_PRICES_CHECKED_ON, findCrystalPrice } from './crystal-prices'

type BossSelection = { bossName: string; difficulty: string }

// Progression uses the catalog's solo base reward as a difficulty proxy.
// A fixed catalog date keeps historical weeks, party sizes and saved prices
// from changing the display order. This is not a measured combat difficulty.
export function compareBossProgression(a: BossSelection, b: BossSelection): number {
  const aPrice = findCrystalPrice(a.bossName, a.difficulty, CRYSTAL_PRICES_CHECKED_ON)?.amount
  const bPrice = findCrystalPrice(b.bossName, b.difficulty, CRYSTAL_PRICES_CHECKED_ON)?.amount
  if (aPrice !== undefined && bPrice !== undefined && aPrice !== bPrice) return aPrice - bPrice
  if (aPrice === undefined && bPrice !== undefined) return 1
  if (aPrice !== undefined && bPrice === undefined) return -1
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
