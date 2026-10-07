import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/contracts/app-api'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const api: AppApi = {
  system: { getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.systemGetInfo) },
  characters: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.charactersList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersUpdate, input),
    setHidden: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersSetHidden, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.charactersRemove, id)
  }
}

contextBridge.exposeInMainWorld('maple', api)
