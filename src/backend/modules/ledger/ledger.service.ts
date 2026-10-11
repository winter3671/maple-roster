import {
  LEDGER_PAGE_SIZE,
  parseLedgerPageQuery,
  parseRecordQuery,
  type LedgerList,
  type LedgerPage
} from '../../../shared/contracts/ledger.contract'
import { sumIntegers } from '../../domain/money'
import { LedgerRepository } from './ledger.repository'
import { ledgerCsv } from '../../domain/ledger-csv'
import { dashboardStatsFromEntries } from '../../domain/dashboard'
import { summarizeLedger } from '../../domain/ledger-summary'

export class LedgerService {
  // Only the last filter's small aggregate is retained; full records are never cached.
  private pageSummary?: {
    key: string
    revision: string
    totals: ReturnType<typeof summarizeLedger>
  }
  constructor(private readonly repository: LedgerRepository) {}
  page(value: unknown): LedgerPage {
    const { page: requestedPage, ...query } = parseLedgerPageQuery(value)
    const key = JSON.stringify(query)
    const revision = this.repository.revision()
    if (this.pageSummary?.key !== key || this.pageSummary.revision !== revision) {
      this.pageSummary = {
        key,
        revision,
        totals: summarizeLedger(this.repository.summaryEntries(query))
      }
    }
    const { summary, incomeGroups, detailCount } = this.pageSummary.totals
    const totalPages = Math.max(1, Math.ceil(detailCount / LEDGER_PAGE_SIZE))
    const page = Math.min(requestedPage, totalPages)
    return {
      entries: this.repository.listDetails(query, page, LEDGER_PAGE_SIZE),
      summary: { ...summary },
      incomeGroups: incomeGroups.map((group) => ({ ...group })),
      pagination: { page, pageSize: LEDGER_PAGE_SIZE, total: detailCount, totalPages }
    }
  }
  dashboard(value: unknown) {
    const query = parseRecordQuery(value)
    return dashboardStatsFromEntries(
      this.repository.dashboardEntries(query),
      query,
      this.repository.list(query, 5)
    )
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
