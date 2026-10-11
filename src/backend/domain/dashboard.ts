import type {
  LedgerEntry,
  LedgerList,
  LedgerSummary,
  RecordQuery
} from '../../shared/contracts/ledger.contract'
import type { DashboardStats } from '../../shared/contracts/dashboard.contract'
import { shiftDate } from '../../shared/boss-period'
import { safeNumber, sumIntegers } from './money'

export type DashboardEntry = Pick<
  LedgerEntry,
  | 'characterId'
  | 'characterName'
  | 'characterWorld'
  | 'date'
  | 'source'
  | 'activity'
  | 'direction'
  | 'amount'
>

type Totals = { income: number; expense: number; net: number; count: number }
const empty = (): Totals => ({ income: 0, expense: 0, net: 0, count: 0 })
export function dashboardStats(list: LedgerList, query: RecordQuery): DashboardStats {
  return dashboardStatsFromEntries(list.entries, query, list.entries.slice(0, 5), list.summary)
}

// Consume a single-pass DB iterator without retaining the complete ledger in memory.
export function dashboardStatsFromEntries(
  entries: Iterable<DashboardEntry>,
  query: RecordQuery,
  recent: LedgerEntry[],
  summary?: LedgerSummary
): DashboardStats {
  const granularity =
    (Date.parse(query.to) - Date.parse(query.from)) / 86400000 <= 61 ? 'day' : 'month'
  const trend = new Map<string, Totals>()
  if (granularity === 'day') {
    for (let date = query.from; date <= query.to; date = shiftDate(date, 1)) {
      trend.set(date, empty())
      if (date === query.to) break
    }
  } else {
    for (let month = query.from.slice(0, 7); month <= query.to.slice(0, 7);) {
      trend.set(month, empty())
      if (month === query.to.slice(0, 7)) break
      const next = new Date(`${month}-01T00:00:00Z`)
      next.setUTCMonth(next.getUTCMonth() + 1)
      month = next.toISOString().slice(0, 7)
    }
  }
  const characters = new Map<string, DashboardStats['characters'][number]>()
  const sources = new Map(
    ['hunting', 'crystal', 'drop', 'manual', 'manualIncome'].map((source) => [source, empty()])
  )
  let income = 0n
  let expense = 0n
  let count = 0
  for (const entry of entries) {
    if (!summary) {
      if (entry.direction === 'income') income += BigInt(entry.amount)
      else expense += BigInt(entry.amount)
    }
    count++
    let character = characters.get(entry.characterId)
    if (!character) {
      character = {
        characterId: entry.characterId,
        name: entry.characterName,
        worlds: [],
        ...empty()
      }
      characters.set(entry.characterId, character)
    }
    if (!character.worlds.includes(entry.characterWorld))
      character.worlds.push(entry.characterWorld)
    const period = granularity === 'day' ? entry.date : entry.date.slice(0, 7)
    const source =
      entry.source === 'drop' && entry.activity === 'hunting' ? 'hunting' : entry.source
    for (const total of [character, sources.get(source)!, trend.get(period)!]) {
      total[entry.direction] = sumIntegers([total[entry.direction], entry.amount])
      total.net = sumIntegers([total.income, -total.expense])
      total.count++
    }
  }
  return {
    summary: summary ?? {
      income: safeNumber(income),
      expense: safeNumber(expense),
      net: safeNumber(income - expense),
      count
    },
    characters: [...characters.values()].sort(
      (a, b) =>
        b.net - a.net ||
        a.name.localeCompare(b.name, 'ko') ||
        a.characterId.localeCompare(b.characterId)
    ),
    sources: [...sources].map(([source, totals]) => ({
      source: source as DashboardStats['sources'][number]['source'],
      ...totals
    })),
    trend: [...trend].map(([period, totals]) => ({ period, ...totals })),
    granularity,
    recent
  }
}
