import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerRoutes, requireIdleKeyChange } from './register-routes'

export function registerNexonHandlers(window: BrowserWindow, services: Services): () => void {
  function change(operation: () => unknown) {
    requireIdleKeyChange()
    const result = operation()
    services.bossSync.invalidatePreviews()
    return result
  }
  return registerRoutes(window, [
    [IPC_CHANNELS.nexonSyncProfiles, (input) => services.nexon.syncProfiles(input)],
    [IPC_CHANNELS.nexonUnlink, (input) => services.nexon.unlink(input)],
    [IPC_CHANNELS.nexonSaveKey, (input) => change(() => services.nexon.saveKey(input))],
    [IPC_CHANNELS.nexonActivateKey, (input) => change(() => services.nexon.activateKey(input))],
    [IPC_CHANNELS.nexonRenameKey, (input) => change(() => services.nexon.renameKey(input))],
    [IPC_CHANNELS.nexonRemoveKey, (input) => change(() => services.nexon.removeKey(input))],
    [IPC_CHANNELS.nexonStatus, () => services.nexon.status()],
    [IPC_CHANNELS.nexonList, () => services.nexon.list()],
    [IPC_CHANNELS.nexonBasic, (input) => services.nexon.basic(input)],
    [IPC_CHANNELS.nexonRegister, (input) => services.nexon.register(input)],
    [IPC_CHANNELS.nexonRegisterMany, (input) => services.nexon.registerMany(input)]
  ])
}
