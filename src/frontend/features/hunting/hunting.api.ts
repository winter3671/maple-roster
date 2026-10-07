import type { HuntingCreate, HuntingUpdate } from '../../../shared/contracts/hunting.contract'
import type { RecordQuery } from '../../../shared/contracts/ledger.contract'
import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

export const huntingApi = {
  list: (query: RecordQuery) => unwrap(getBridge().hunting.list(query)),
  create: (input: HuntingCreate) => unwrap(getBridge().hunting.create(input)),
  update: (input: HuntingUpdate) => unwrap(getBridge().hunting.update(input)),
  remove: (id: string) => unwrap(getBridge().hunting.remove(id))
}
