import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/contracts/app-api'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const api: AppApi = {
  system: { getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.systemGetInfo) }
}

contextBridge.exposeInMainWorld('maple', api)
