import type { LedgerEntry, LedgerSummary } from './ledger.contract'

export interface DashboardStats {
  summary: LedgerSummary
  characters: {
    characterId: string
    name: string
    worlds: string[]
    income: number
    expense: number
    net: number
    count: number
  }[]
  sources: {
    source: LedgerEntry['source']
    income: number
    expense: number
    net: number
    count: number
  }[]
  trend: { period: string; income: number; expense: number; net: number; count: number }[]
  granularity: 'day' | 'month'
  recent: LedgerEntry[]
}
