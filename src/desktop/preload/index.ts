import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/contracts/app-api'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const api: AppApi = {
  backup: {
    exportFile: () => ipcRenderer.invoke(IPC_CHANNELS.backupExport),
    selectFile: () => ipcRenderer.invoke(IPC_CHANNELS.backupSelect),
    restore: (previewId) => ipcRenderer.invoke(IPC_CHANNELS.backupRestore, { previewId }),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.backupCancel)
  },
  drops: {
    list: (source) => ipcRenderer.invoke(IPC_CHANNELS.dropsList, source),
    createLot: (input) => ipcRenderer.invoke(IPC_CHANNELS.dropsCreateLot, input),
    updateLot: (input) => ipcRenderer.invoke(IPC_CHANNELS.dropsUpdateLot, input),
    removeLot: (id) => ipcRenderer.invoke(IPC_CHANNELS.dropsRemoveLot, id),
    createSale: (input) => ipcRenderer.invoke(IPC_CHANNELS.dropsCreateSale, input),
    updateSale: (input) => ipcRenderer.invoke(IPC_CHANNELS.dropsUpdateSale, input),
    cancelSale: (id) => ipcRenderer.invoke(IPC_CHANNELS.dropsCancelSale, id)
  },
  bosses: {
    syncClears: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSyncClears, input),
    previewClears: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesPreviewClears, input),
    applyClears: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesApplyClears, input),
    rosterState: () => ipcRenderer.invoke(IPC_CHANNELS.bossesRosterState),
    saveTemplate: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSaveTemplate, input),
    removeTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesRemoveTemplate, id),
    assignTemplate: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesAssignTemplate, input),
    saveRoster: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSaveRoster, input),
    presets: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesPresets, id),
    createPreset: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesCreatePreset, input),
    updatePreset: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesUpdatePreset, input),
    removePreset: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesRemovePreset, id),
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.bossesList, query),
    generate: (query) => ipcRenderer.invoke(IPC_CHANNELS.bossesGenerate, query),
    setClear: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSetClear, input),
    updateRun: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesUpdateRun, input),
    createRun: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesCreateRun, input),
    settle: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSettle, input),
    cancelSale: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesCancelSale, id),
    removeRun: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesRemoveRun, id)
  },
  nexon: {
    syncProfiles: (input) => ipcRenderer.invoke(IPC_CHANNELS.nexonSyncProfiles, input),
    unlink: (id) => ipcRenderer.invoke(IPC_CHANNELS.nexonUnlink, id),
    saveKey: (key) => ipcRenderer.invoke(IPC_CHANNELS.nexonSaveKey, key),
    removeKey: () => ipcRenderer.invoke(IPC_CHANNELS.nexonRemoveKey),
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
    exportCsv: (query) => ipcRenderer.invoke(IPC_CHANNELS.ledgerExportCsv, query),
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.ledgerList, query)
  }
}

contextBridge.exposeInMainWorld('maple', api)
