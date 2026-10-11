import type {
  LedgerEntry,
  LedgerIncomeGroup,
  LedgerSummary
} from '../../shared/contracts/ledger.contract'
import { safeNumber } from './money'

export type LedgerSummaryEntry = Pick<LedgerEntry, 'amount' | 'direction' | 'source' | 'activity'>

export function summarizeLedger(entries: Iterable<LedgerSummaryEntry>): {
  summary: LedgerSummary
  incomeGroups: LedgerIncomeGroup[]
  detailCount: number
} {
  let income = 0n,
    expense = 0n,
    count = 0,
    detailCount = 0
  const groups = new Map<LedgerIncomeGroup['activity'], { amount: bigint; count: number }>(
    (['boss', 'hunting', 'income'] as const).map((activity) => [activity, { amount: 0n, count: 0 }])
  )
  for (const entry of entries) {
    const amount = BigInt(entry.amount)
    count++
    if (entry.direction === 'expense') {
      expense += amount
      detailCount++
    } else {
      income += amount
      if (entry.source === 'manualIncome') detailCount++
      const group = groups.get(entry.activity as LedgerIncomeGroup['activity'])!
      group.amount += amount
      group.count++
    }
  }
  return {
    summary: {
      income: safeNumber(income),
      expense: safeNumber(expense),
      net: safeNumber(income - expense),
      count
    },
    incomeGroups: [...groups].map(([activity, group]) => ({
      activity,
      amount: safeNumber(group.amount),
      count: group.count
    })),
    detailCount
  }
}
