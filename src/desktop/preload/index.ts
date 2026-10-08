import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/contracts/app-api'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const api: AppApi = {
  nexon: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.nexonStatus),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.nexonList),
    basic: (ocid) => ipcRenderer.invoke(IPC_CHANNELS.nexonBasic, ocid),
    register: (ocid) => ipcRenderer.invoke(IPC_CHANNELS.nexonRegister, ocid)
  },
  system: { getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.systemGetInfo) },
  characters: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.charactersList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersUpdate, input),
    setHidden: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersSetHidden, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.charactersRemove, id)
  },
  hunting: {
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.huntingList, query),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.huntingCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.huntingUpdate, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.huntingRemove, id)
  },
  ledger: {
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.ledgerList, query)
  }
}

contextBridge.exposeInMainWorld('maple', api)
