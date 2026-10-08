import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'
import type {
  BossPresetInput,
  BossPresetUpdate,
  BossQuery,
  BossRunUpdate,
  CrystalInput
} from '../../../shared/contracts/boss.contract'

export const bossesApi = {
  presets: (id?: string) => unwrap(getBridge().bosses.presets(id)),
  createPreset: (input: BossPresetInput) => unwrap(getBridge().bosses.createPreset(input)),
  updatePreset: (input: BossPresetUpdate) => unwrap(getBridge().bosses.updatePreset(input)),
  removePreset: (id: string) => unwrap(getBridge().bosses.removePreset(id)),
  list: (query: BossQuery) => unwrap(getBridge().bosses.list(query)),
  generate: (query: BossQuery) => unwrap(getBridge().bosses.generate(query)),
  setClear: (id: string, isCleared: boolean) =>
    unwrap(getBridge().bosses.setClear({ id, isCleared })),
  updateRun: (input: BossRunUpdate) => unwrap(getBridge().bosses.updateRun(input)),
  settle: (input: CrystalInput) => unwrap(getBridge().bosses.settle(input)),
  cancelSale: (id: string) => unwrap(getBridge().bosses.cancelSale(id)),
  removeRun: (id: string) => unwrap(getBridge().bosses.removeRun(id))
}
