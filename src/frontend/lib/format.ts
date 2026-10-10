import { getKstDate } from '../../shared/dates'
import type { RecordQuery, LedgerEntry } from '../../shared/contracts/ledger.contract'

export const formatMeso = (value: number) => value.toLocaleString('ko-KR')
export { formatKoreanMeso } from '../../shared/meso-format'
export function ledgerLabel(entry: LedgerEntry): string {
  if (entry.source === 'manualIncome') return entry.incomeCategory ?? '직접 수익'
  if (entry.source === 'manual') return entry.expenseCategory ?? '직접 지출'
  if (entry.source === 'drop') return '드랍 판매'
  return entry.source === 'crystal'
    ? '결정석 수익'
    : entry.direction === 'income'
      ? '사냥 획득'
      : '사냥 소모 비용'
}
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours > 0 ? `${hours}시간${remaining > 0 ? ` ${remaining}분` : ''}` : `${remaining}분`
}

export function thisMonthQuery(): RecordQuery {
  const today = getKstDate()
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

export function parseDigits(value: string): number {
  const raw = value.replaceAll(',', '').trim()
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN
}
