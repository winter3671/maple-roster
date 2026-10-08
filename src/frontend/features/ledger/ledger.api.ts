import type { RecordQuery } from '../../../shared/contracts/ledger.contract'
import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

export const ledgerApi = {
  list: (query: RecordQuery) => unwrap(getBridge().ledger.list(query)),
  exportCsv: (query: RecordQuery) => unwrap(getBridge().ledger.exportCsv(query))
}
