import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerRoutes } from './register-routes'

export function registerHuntingHandlers(window: BrowserWindow, services: Services): () => void {
  return registerRoutes(window, [
    [IPC_CHANNELS.huntingList, (input) => services.hunting.list(input)],
    [IPC_CHANNELS.huntingCreate, (input) => services.hunting.create(input)],
    [IPC_CHANNELS.huntingUpdate, (input) => services.hunting.update(input)],
    [IPC_CHANNELS.huntingRemove, (input) => services.hunting.remove(input)]
  ])
}
