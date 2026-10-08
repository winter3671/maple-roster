import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerCharacterHandlers } from './character.handlers'
import { registerHuntingHandlers } from './hunting.handlers'
import { registerNexonHandlers } from './nexon.handlers'
import { registerBossHandlers } from './boss.handlers'
import { registerRoutes } from './register-routes'

export function registerHandlers(window: BrowserWindow, services: Services): void {
  const disposeCharacters = registerCharacterHandlers(window, services)
  const disposeHunting = registerHuntingHandlers(window, services)
  const disposeNexon = registerNexonHandlers(window, services)
  const disposeBosses = registerBossHandlers(window, services)
  const disposeDrops = registerRoutes(window, [
    [IPC_CHANNELS.dropsList, (input) => services.drops.list(input)],
    [IPC_CHANNELS.dropsCreateLot, (input) => services.drops.createLot(input)],
    [IPC_CHANNELS.dropsUpdateLot, (input) => services.drops.updateLot(input)],
    [IPC_CHANNELS.dropsRemoveLot, (input) => services.drops.removeLot(input)],
    [IPC_CHANNELS.dropsCreateSale, (input) => services.drops.createSale(input)],
    [IPC_CHANNELS.dropsUpdateSale, (input) => services.drops.updateSale(input)],
    [IPC_CHANNELS.dropsCancelSale, (input) => services.drops.cancelSale(input)]
  ])
  ipcMain.handle(IPC_CHANNELS.systemGetInfo, (event) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('허용되지 않은 요청입니다.')
    }
    return services.system.getInfo()
  })
  window.once('closed', () => {
    ipcMain.removeHandler(IPC_CHANNELS.systemGetInfo)
    disposeCharacters()
    disposeHunting()
    disposeNexon()
    disposeBosses()
    disposeDrops()
  })
}
