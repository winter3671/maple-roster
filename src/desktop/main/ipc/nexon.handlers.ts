import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerRoutes } from './register-routes'

export function registerNexonHandlers(window: BrowserWindow, services: Services): () => void {
  return registerRoutes(window, [
    [IPC_CHANNELS.nexonStatus, () => services.nexon.status()],
    [IPC_CHANNELS.nexonList, () => services.nexon.list()],
    [IPC_CHANNELS.nexonBasic, (input) => services.nexon.basic(input)],
    [IPC_CHANNELS.nexonRegister, (input) => services.nexon.register(input)]
  ])
}
