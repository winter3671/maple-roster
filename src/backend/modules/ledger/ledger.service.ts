import { parseRecordQuery, type LedgerList } from '../../../shared/contracts/ledger.contract'
import { sumIntegers } from '../../domain/money'
import { LedgerRepository } from './ledger.repository'

export class LedgerService {
  constructor(private readonly repository: LedgerRepository) {}

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
