import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerRoutes } from './register-routes'

export function registerCharacterHandlers(window: BrowserWindow, services: Services): () => void {
  return registerRoutes(window, [
    [IPC_CHANNELS.charactersList, () => services.characters.list()],
    [IPC_CHANNELS.charactersCreate, (input: unknown) => services.characters.create(input)],
    [IPC_CHANNELS.charactersUpdate, (input: unknown) => services.characters.update(input)],
    [IPC_CHANNELS.charactersRemove, (input: unknown) => services.characters.remove(input)]
  ])
}
