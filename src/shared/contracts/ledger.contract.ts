import { readDate } from '../dates'
import { AppError } from '../errors'
import { readId, readInteger, readObject } from '../validation'

export interface RecordQuery {
  from: string
  to: string
  characterId?: string
}
export interface LedgerEntry {
  id: string
  huntingSessionId: string | null
  crystalSettlementId: string | null
  dropSaleId: string | null
  manualExpenseId?: string | null
  manualIncomeId?: string | null
  incomeCategory?: string
  expenseCategory?: string
  expenseCurrency?: 'meso' | 'maplePoint'
  pointAmount?: number | null
  pointsPer100m?: number | null
  notes?: string
  source: 'hunting' | 'crystal' | 'drop' | 'manual' | 'manualIncome'
  activity: 'boss' | 'hunting' | 'expense' | 'income'
  characterId: string
  characterName: string
  characterWorld: string
  date: string
  direction: 'income' | 'expense'
  amount: number
}
export interface LedgerSummary {
  income: number
  expense: number
  net: number
  count: number
}
export interface LedgerList {
  entries: LedgerEntry[]
  summary: LedgerSummary
}

export const LEDGER_PAGE_SIZE = 50
export interface LedgerPageQuery extends RecordQuery {
  page: number
}
export interface LedgerIncomeGroup {
  activity: 'boss' | 'hunting' | 'income'
  amount: number
  count: number
}
export interface LedgerPage extends LedgerList {
  incomeGroups: LedgerIncomeGroup[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export function parseLedgerPageQuery(value: unknown): LedgerPageQuery {
  const input = readObject(value)
  const page = readInteger(input.page === undefined ? 1 : input.page, '페이지')
  if (page === 0) throw new AppError('VALIDATION_ERROR', '페이지는 1 이상이어야 합니다.')
  return { ...parseRecordQuery(value), page }
}

export function parseRecordQuery(value: unknown): RecordQuery {
  const query = readObject(value)
  const from = readDate(query.from)
  const to = readDate(query.to)
  if (from > to) throw new AppError('VALIDATION_ERROR', '시작일은 종료일보다 늦을 수 없습니다.')
  const characterId =
    query.characterId === undefined || query.characterId === ''
      ? undefined
      : readId(query.characterId)
  return { from, to, ...(characterId === undefined ? {} : { characterId }) }
}
