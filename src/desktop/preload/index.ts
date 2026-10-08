import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/contracts/app-api'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const api: AppApi = {
  bosses: {
    presets: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesPresets, id),
    createPreset: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesCreatePreset, input),
    updatePreset: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesUpdatePreset, input),
    removePreset: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesRemovePreset, id),
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.bossesList, query),
    generate: (query) => ipcRenderer.invoke(IPC_CHANNELS.bossesGenerate, query),
    setClear: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSetClear, input),
    updateRun: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesUpdateRun, input),
    settle: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSettle, input),
    cancelSale: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesCancelSale, id),
    removeRun: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesRemoveRun, id)
  },
  nexon: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.nexonStatus),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.nexonList),
    basic: (ocid) => ipcRenderer.invoke(IPC_CHANNELS.nexonBasic, ocid),
    register: (ocid) => ipcRenderer.invoke(IPC_CHANNELS.nexonRegister, ocid),
    registerMany: (ocids) => ipcRenderer.invoke(IPC_CHANNELS.nexonRegisterMany, ocids)
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
