import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

export const nexonApi = {
  status: () => unwrap(getBridge().nexon.status()),
  list: () => unwrap(getBridge().nexon.list()),
  basic: (ocid: string) => unwrap(getBridge().nexon.basic(ocid)),
  register: (ocid: string) => unwrap(getBridge().nexon.register(ocid))
}
