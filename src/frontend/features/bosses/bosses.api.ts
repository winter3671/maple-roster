import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'
import type { BossMember, BossTemplateInput } from '../../../shared/contracts/boss-roster.contract'
import type {
  BossPresetInput,
  BossPresetUpdate,
  BossQuery,
  BossRunUpdate,
  BossRunCreate,
  CrystalInput
} from '../../../shared/contracts/boss.contract'

export const bossesApi = {
  previewClears: (date: string, characterId: string) =>
    unwrap(getBridge().bosses.previewClears({ date, characterId })),
  applyClears: (previewId: string, runIds: string[], incomeDate: string) =>
    unwrap(getBridge().bosses.applyClears({ previewId, runIds, incomeDate })),
  rosterState: () => unwrap(getBridge().bosses.rosterState()),
  saveTemplate: (input: BossTemplateInput & { id?: string }) =>
    unwrap(getBridge().bosses.saveTemplate(input)),
  removeTemplate: (id: string) => unwrap(getBridge().bosses.removeTemplate(id)),
  assignTemplate: (templateId: string, characterIds: string[]) =>
    unwrap(getBridge().bosses.assignTemplate({ templateId, characterIds })),
  saveRoster: (characterId: string, members: BossMember[]) =>
    unwrap(getBridge().bosses.saveRoster({ characterId, members })),
  presets: (id?: string) => unwrap(getBridge().bosses.presets(id)),
  createPreset: (input: BossPresetInput) => unwrap(getBridge().bosses.createPreset(input)),
  updatePreset: (input: BossPresetUpdate) => unwrap(getBridge().bosses.updatePreset(input)),
  removePreset: (id: string) => unwrap(getBridge().bosses.removePreset(id)),
  list: (query: BossQuery) => unwrap(getBridge().bosses.list(query)),
  generate: (query: BossQuery) => unwrap(getBridge().bosses.generate(query)),
  setClear: (id: string, isCleared: boolean) =>
    unwrap(getBridge().bosses.setClear({ id, isCleared })),
  updateRun: (input: BossRunUpdate) => unwrap(getBridge().bosses.updateRun(input)),
  createRun: (input: BossRunCreate) => unwrap(getBridge().bosses.createRun(input)),
  settle: (input: CrystalInput) => unwrap(getBridge().bosses.settle(input)),
  cancelSale: (id: string) => unwrap(getBridge().bosses.cancelSale(id)),
  removeRun: (id: string) => unwrap(getBridge().bosses.removeRun(id))
}
