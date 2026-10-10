import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'
import type { NexonKeyRegistration } from '../../../shared/contracts/nexon.contract'

export const nexonApi = {
  openKeyGuide: async () => {
    const bridge = getBridge()
    if (typeof bridge.nexon.openKeyGuide !== 'function')
      throw new Error(
        '발급 가이드 연결을 적용하려면 앱을 완전히 종료한 뒤 다시 실행해 주세요. 개발 실행 중이라면 터미널에서 Ctrl+C 후 npm run dev로 다시 시작하세요.'
      )
    return unwrap(bridge.nexon.openKeyGuide())
  },
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
