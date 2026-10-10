import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'
import type {
  BossQuery,
  BossRunUpdate,
  BossIncomeDateUpdate,
  BossRunCreate,
  CrystalInput
} from '../../../shared/contracts/boss.contract'

export const bossesApi = {
  syncClears: (date: string, cycle?: 'weekly' | 'monthly', characterId?: string) =>
    unwrap(getBridge().bosses.syncClears({ date, cycle, characterId })),
  replaceClears: (
    previewId: string,
    members: { bossName: string; difficulty: string; partySize: number }[],
    incomeDate: string
  ) => unwrap(getBridge().bosses.applyClears({ previewId, mode: 'replace', members, incomeDate })),
  previewClears: (date: string, characterId: string) =>
    unwrap(getBridge().bosses.previewClears({ date, characterId })),
  applyClears: (previewId: string, runIds: string[], incomeDate: string) =>
    unwrap(getBridge().bosses.applyClears({ previewId, runIds, incomeDate })),
  list: (query: BossQuery) => unwrap(getBridge().bosses.list(query)),
  setClear: (id: string, isCleared: boolean) =>
    unwrap(getBridge().bosses.setClear({ id, isCleared })),
  updateRun: (input: BossRunUpdate) => unwrap(getBridge().bosses.updateRun(input)),
  updateIncomeDate: (input: BossIncomeDateUpdate) =>
    unwrap(getBridge().bosses.updateIncomeDate(input)),
  createRun: (input: BossRunCreate) => unwrap(getBridge().bosses.createRun(input)),
  settle: (input: CrystalInput) => unwrap(getBridge().bosses.settle(input)),
  cancelSale: (id: string) => unwrap(getBridge().bosses.cancelSale(id)),
  removeRun: (id: string) => unwrap(getBridge().bosses.removeRun(id))
}
