import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/contracts/app-api'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const api: AppApi = {
  updates: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.updatesStatus),
    check: () => ipcRenderer.invoke(IPC_CHANNELS.updatesCheck),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.updatesDownload),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.updatesInstall)
  },
  prices: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.pricesList)
  },
  dashboard: { summary: (query) => ipcRenderer.invoke(IPC_CHANNELS.dashboardSummary, query) },
  backup: {
    automaticStatus: () => ipcRenderer.invoke(IPC_CHANNELS.backupAutomaticStatus),
    automaticNow: () => ipcRenderer.invoke(IPC_CHANNELS.backupAutomaticNow),
    exportFile: () => ipcRenderer.invoke(IPC_CHANNELS.backupExport),
    selectFile: () => ipcRenderer.invoke(IPC_CHANNELS.backupSelect),
    restore: (previewId) => ipcRenderer.invoke(IPC_CHANNELS.backupRestore, { previewId }),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.backupCancel)
  },
  weekly: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.weeklyList),
    sync: () => ipcRenderer.invoke(IPC_CHANNELS.weeklySync)
  },
  drops: {
    setHuntingSale: (input) => ipcRenderer.invoke(IPC_CHANNELS.dropsSetHuntingSale, input),
    createBossLots: (input) => ipcRenderer.invoke(IPC_CHANNELS.dropsCreateBossLots, input),
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
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.bossesList, query),
    setClear: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSetClear, input),
    updateRun: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesUpdateRun, input),
    updateIncomeDate: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesUpdateIncomeDate, input),
    createRun: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesCreateRun, input),
    settle: (input) => ipcRenderer.invoke(IPC_CHANNELS.bossesSettle, input),
    cancelSale: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesCancelSale, id),
    removeRun: (id) => ipcRenderer.invoke(IPC_CHANNELS.bossesRemoveRun, id)
  },
  nexon: {
    syncProfiles: (input) => ipcRenderer.invoke(IPC_CHANNELS.nexonSyncProfiles, input),
    unlink: (id) => ipcRenderer.invoke(IPC_CHANNELS.nexonUnlink, id),
    saveKey: (key) => ipcRenderer.invoke(IPC_CHANNELS.nexonSaveKey, key),
    activateKey: (id) => ipcRenderer.invoke(IPC_CHANNELS.nexonActivateKey, id),
    renameKey: (input) => ipcRenderer.invoke(IPC_CHANNELS.nexonRenameKey, input),
    removeKey: (id) => ipcRenderer.invoke(IPC_CHANNELS.nexonRemoveKey, id),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.nexonStatus),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.nexonList),
    basic: (ocid) => ipcRenderer.invoke(IPC_CHANNELS.nexonBasic, ocid),
    register: (ocid) => ipcRenderer.invoke(IPC_CHANNELS.nexonRegister, ocid),
    registerMany: (ocids) => ipcRenderer.invoke(IPC_CHANNELS.nexonRegisterMany, ocids)
  },
  system: { getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.systemGetInfo) },
  characters: {
    avatar: (id) => ipcRenderer.invoke(IPC_CHANNELS.charactersAvatar, id),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.charactersList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.charactersUpdate, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.charactersRemove, id)
  },
  hunting: {
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.huntingList, query),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.huntingCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.huntingUpdate, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.huntingRemove, id)
  },
  ledger: {
    createIncome: (input) => ipcRenderer.invoke(IPC_CHANNELS.ledgerCreateIncome, input),
    updateIncome: (input) => ipcRenderer.invoke(IPC_CHANNELS.ledgerUpdateIncome, input),
    removeIncome: (id) => ipcRenderer.invoke(IPC_CHANNELS.ledgerRemoveIncome, id),
    createExpense: (input) => ipcRenderer.invoke(IPC_CHANNELS.ledgerCreateExpense, input),
    updateExpense: (input) => ipcRenderer.invoke(IPC_CHANNELS.ledgerUpdateExpense, input),
    removeExpense: (id) => ipcRenderer.invoke(IPC_CHANNELS.ledgerRemoveExpense, id),
    exportCsv: (query) => ipcRenderer.invoke(IPC_CHANNELS.ledgerExportCsv, query),
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.ledgerList, query)
  }
}

contextBridge.exposeInMainWorld('maple', api)
