import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'

export function registerHandlers(window: BrowserWindow, services: Services): void {
  ipcMain.handle(IPC_CHANNELS.systemGetInfo, (event) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('허용되지 않은 요청입니다.')
    }
    return services.system.getInfo()
  })
  window.once('closed', () => ipcMain.removeHandler(IPC_CHANNELS.systemGetInfo))
}
