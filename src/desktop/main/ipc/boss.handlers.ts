import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS as C } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerRoutes } from './register-routes'

export function registerBossHandlers(window: BrowserWindow, services: Services): () => void {
  const bosses = services.bosses
  return registerRoutes(window, [
    [C.bossesSyncClears, (input) => services.bossSync.syncAll(input)],
    [C.bossesPreviewClears, (input) => services.bossSync.preview(input)],
    [C.bossesApplyClears, (input) => services.bossSync.apply(input)],
    [C.bossesList, (input) => bosses.list(input)],
    [C.bossesSetClear, (input) => bosses.setClear(input)],
    [C.bossesUpdateRun, (input) => bosses.updateRun(input)],
    [C.bossesUpdateIncomeDate, (input) => bosses.updateIncomeDate(input)],
    [C.bossesCreateRun, (input) => bosses.createRun(input)],
    [C.bossesSettle, (input) => bosses.settle(input)],
    [C.bossesCancelSale, (input) => bosses.cancelSale(input)],
    [C.bossesRemoveRun, (input) => bosses.removeRun(input)]
  ])
}
