import type { RecordQuery } from '../../../shared/contracts/ledger.contract'
import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

import type { ExpenseCreate, ExpenseUpdate } from '../../../shared/contracts/expense.contract'

export const ledgerApi = {
  createExpense: (input: ExpenseCreate) => unwrap(getBridge().ledger.createExpense(input)),
  updateExpense: (input: ExpenseUpdate) => unwrap(getBridge().ledger.updateExpense(input)),
  removeExpense: (id: string) => unwrap(getBridge().ledger.removeExpense(id)),
  list: (query: RecordQuery) => unwrap(getBridge().ledger.list(query)),
  exportCsv: (query: RecordQuery) => unwrap(getBridge().ledger.exportCsv(query))
}
