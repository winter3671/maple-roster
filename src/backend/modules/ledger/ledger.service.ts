import { parseRecordQuery, type LedgerList } from '../../../shared/contracts/ledger.contract'
import { sumIntegers } from '../../domain/money'
import { LedgerRepository } from './ledger.repository'
import { ledgerCsv } from '../../domain/ledger-csv'
import { dashboardStats } from '../../domain/dashboard'

export class LedgerService {
  constructor(private readonly repository: LedgerRepository) {}
  dashboard(value: unknown) {
    const query = parseRecordQuery(value)
    return dashboardStats(this.list(query), query)
  }
  exportCsv(value: unknown) {
    const query = parseRecordQuery(value)
    const entries = this.repository.list(query)
    return { content: ledgerCsv(entries), count: entries.length, query }
  }

  list(value: unknown): LedgerList {
    const entries = this.repository.list(parseRecordQuery(value))
    const income = sumIntegers(
      entries.filter((entry) => entry.direction === 'income').map((entry) => entry.amount)
    )
    const expense = sumIntegers(
      entries.filter((entry) => entry.direction === 'expense').map((entry) => entry.amount)
    )
    return {
      entries,
      summary: { income, expense, net: sumIntegers([income, -expense]), count: entries.length }
    }
  }
}
