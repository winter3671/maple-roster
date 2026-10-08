import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

export const nexonApi = {
  syncProfiles: (force: boolean, characterIds?: string[]) =>
    unwrap(getBridge().nexon.syncProfiles({ force, characterIds })),
  unlink: (id: string) => unwrap(getBridge().nexon.unlink(id)),
  saveKey: (key: string) => unwrap(getBridge().nexon.saveKey(key)),
  removeKey: () => unwrap(getBridge().nexon.removeKey()),
  status: () => unwrap(getBridge().nexon.status()),
  list: () => unwrap(getBridge().nexon.list()),
  basic: (ocid: string) => unwrap(getBridge().nexon.basic(ocid)),
  register: (ocid: string) => unwrap(getBridge().nexon.register(ocid)),
  registerMany: (ocids: string[]) => unwrap(getBridge().nexon.registerMany(ocids))
}
