import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'
import type { NexonKeyRegistration } from '../../../shared/contracts/nexon.contract'

export const nexonApi = {
  openKeyGuide: () => unwrap(getBridge().nexon.openKeyGuide()),
  syncProfiles: (force: boolean, characterIds?: string[]) =>
    unwrap(getBridge().nexon.syncProfiles({ force, characterIds })),
  unlink: (id: string) => unwrap(getBridge().nexon.unlink(id)),
  saveKey: (input: NexonKeyRegistration) => unwrap(getBridge().nexon.saveKey(input)),
  activateKey: (id: string) => unwrap(getBridge().nexon.activateKey(id)),
  renameKey: (id: string, label: string) => unwrap(getBridge().nexon.renameKey({ id, label })),
  removeKey: (id?: string) => unwrap(getBridge().nexon.removeKey(id)),
  status: () => unwrap(getBridge().nexon.status()),
  list: () => unwrap(getBridge().nexon.list()),
  basic: (ocid: string) => unwrap(getBridge().nexon.basic(ocid)),
  register: (ocid: string) => unwrap(getBridge().nexon.register(ocid)),
  registerMany: (ocids: string[]) => unwrap(getBridge().nexon.registerMany(ocids))
}
