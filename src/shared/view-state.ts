import type { RecordQuery } from './contracts/ledger.contract'
import type { BossQuery } from './contracts/boss.contract'

export type BossView = 'overview' | 'weekly' | 'monthly'
export interface ViewStates {
  dashboardQuery: RecordQuery
  huntingQuery: RecordQuery
  huntingMode: 'quick' | 'detail'
  ledger: { query: RecordQuery; page: number }
  bossView: BossView
  bossOverview: { date: string; month: string; characterId: string }
  weeklyBossQuery: BossQuery
  monthlyBossQuery: BossQuery
  weeklyPrevious: boolean
}

// Session-only display preferences. Form values, results and API credentials never belong here.
export class ViewStateStore {
  private values: Partial<ViewStates> = {}
  private listeners = new Set<() => void>()
  read<K extends keyof ViewStates>(key: K, initial: () => ViewStates[K]): ViewStates[K] {
    if (this.values[key] === undefined) this.values[key] = structuredClone(initial())
    return this.values[key] as ViewStates[K]
  }
  update<K extends keyof ViewStates>(
    key: K,
    initial: () => ViewStates[K],
    value: ViewStates[K] | ((current: ViewStates[K]) => ViewStates[K])
  ) {
    const current = this.read(key, initial)
    const next = typeof value === 'function' ? value(current) : value
    if (Object.is(current, next)) return
    // Preserve unchanged nested references so changing a page/mode does not restart other queries.
    this.values[key] = next
    for (const listener of this.listeners) listener()
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export function missingCharacter(
  characterId: string | undefined,
  characters: readonly { id: string }[],
  loaded: boolean
) {
  return loaded && Boolean(characterId) && !characters.some((row) => row.id === characterId)
}

export function resolveLedgerPage(
  current: ViewStates['ledger'],
  requestedQuery: RecordQuery,
  requestedPage: number,
  resolvedPage: number
): ViewStates['ledger'] {
  return current.query === requestedQuery &&
    current.page === requestedPage &&
    resolvedPage !== requestedPage
    ? { ...current, page: resolvedPage }
    : current
}
