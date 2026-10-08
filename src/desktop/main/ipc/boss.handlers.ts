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
    [C.bossesRosterState, () => services.bossRosters.state()],
    [C.bossesSaveTemplate, (input) => services.bossRosters.saveTemplate(input)],
    [C.bossesRemoveTemplate, (input) => services.bossRosters.removeTemplate(input)],
    [C.bossesAssignTemplate, (input) => services.bossRosters.assign(input)],
    [C.bossesSaveRoster, (input) => services.bossRosters.saveRoster(input)],
    [C.bossesPresets, (input) => bosses.presets(input)],
    [C.bossesCreatePreset, (input) => bosses.createPreset(input)],
    [C.bossesUpdatePreset, (input) => bosses.updatePreset(input)],
    [C.bossesRemovePreset, (input) => bosses.removePreset(input)],
    [C.bossesList, (input) => bosses.list(input)],
    [C.bossesGenerate, (input) => bosses.generate(input)],
    [C.bossesSetClear, (input) => bosses.setClear(input)],
    [C.bossesUpdateRun, (input) => bosses.updateRun(input)],
    [C.bossesCreateRun, (input) => bosses.createRun(input)],
    [C.bossesSettle, (input) => bosses.settle(input)],
    [C.bossesCancelSale, (input) => bosses.cancelSale(input)],
    [C.bossesRemoveRun, (input) => bosses.removeRun(input)]
  ])
}
