import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerCharacterHandlers } from './character.handlers'
import { registerHuntingHandlers } from './hunting.handlers'
import { registerNexonHandlers } from './nexon.handlers'
import { registerBossHandlers } from './boss.handlers'
import { registerRoutes } from './register-routes'
import { registerBackupHandlers } from './backup.handlers'
import { registerLedgerHandlers } from './ledger.handlers'
import type { UpdateService } from '../update.service'
import type { CharacterAvatarService } from '../character-avatar.service'

export function registerHandlers(
  window: BrowserWindow,
  services: Services,
  updates: UpdateService,
  avatars: CharacterAvatarService
): void {
  const disposeUpdates = registerRoutes(window, [
    [IPC_CHANNELS.charactersAvatar, (id) => avatars.get(id)],
    [IPC_CHANNELS.updatesStatus, () => updates.status()],
    [IPC_CHANNELS.updatesCheck, () => updates.check()],
    [IPC_CHANNELS.updatesDownload, () => updates.download()],
    [IPC_CHANNELS.updatesInstall, () => updates.install()]
  ])
  const disposeCharacters = registerCharacterHandlers(window, services)
  const disposeHunting = registerHuntingHandlers(window, services)
  const disposeNexon = registerNexonHandlers(window, services)
  const disposeBosses = registerBossHandlers(window, services)
  const disposeBackup = registerBackupHandlers(window, services)
  const disposeLedger = registerLedgerHandlers(window, services)
  const disposePrices = registerRoutes(window, [
    [IPC_CHANNELS.pricesList, () => services.prices.list()],
    [
      IPC_CHANNELS.pricesSave,
      (input) => {
        const result = services.prices.save(input)
        services.bossSync.invalidatePreviews()
        return result
      }
    ],
    [
      IPC_CHANNELS.pricesRemove,
      (id) => {
        const result = services.prices.remove(id)
        services.bossSync.invalidatePreviews()
        return result
      }
    ]
  ])
  const disposeDrops = registerRoutes(window, [
    [IPC_CHANNELS.dropsCreateBossLots, (input) => services.drops.createBossLots(input)],
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
    disposeUpdates()
    ipcMain.removeHandler(IPC_CHANNELS.systemGetInfo)
    disposeCharacters()
    disposeHunting()
    disposeNexon()
    disposeBosses()
    disposeBackup()
    disposeLedger()
    disposePrices()
    disposeDrops()
  })
}
