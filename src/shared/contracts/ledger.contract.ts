import { readDate } from '../dates'
import { AppError } from '../errors'
import { readId, readObject } from '../validation'

export interface RecordQuery {
  from: string
  to: string
  characterId?: string
}
export interface LedgerEntry {
  id: string
  huntingSessionId: string | null
  crystalSettlementId: string | null
  source: 'hunting' | 'crystal'
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
