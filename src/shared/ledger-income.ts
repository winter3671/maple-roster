import type { LedgerEntry } from './contracts/ledger.contract'
import { AppError } from './errors'

export function groupLedgerIncome(entries: LedgerEntry[]) {
  return (['boss', 'hunting', 'income'] as const).map((activity) => {
    const rows = entries.filter(
      (entry) => entry.direction === 'income' && entry.activity === activity
    )
    const amount = Number(rows.reduce((sum, entry) => sum + BigInt(entry.amount), 0n))
    if (!Number.isSafeInteger(amount))
      throw new AppError('VALIDATION_ERROR', '수익 합계가 처리할 수 있는 범위를 넘었습니다.')
    return { activity, amount, count: rows.length }
  })
}
