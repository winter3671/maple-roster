import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import { hasActiveRequests } from './ipc/register-routes'

interface WindowProtection {
  ready: boolean
  approved: boolean
  restarting?: () => boolean
}
const protectedWindows = new WeakMap<BrowserWindow, WindowProtection>()
export function approveWindowRestart(window: BrowserWindow, restarting: () => boolean): void {
  const state = protectedWindows.get(window)
  if (state) state.restarting = restarting
}
export function enableInputProtection(window: BrowserWindow): void {
  const state = protectedWindows.get(window)
  if (state) state.ready = true
}
export function approveWindowClose(window: BrowserWindow): void {
  const state = protectedWindows.get(window)
  if (state) state.approved = true
  // Return the IPC result before closing the sender's webContents.
  setImmediate(() => {
    if (!window.isDestroyed()) window.close()
  })
}

const outputDir = fileURLToPath(new URL('.', import.meta.url))

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 920,
    minHeight: 680,
    show: false,
    title: 'Maple Roster',
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(outputDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const protection: WindowProtection = { ready: false, approved: false }
  protectedWindows.set(window, protection)
  window.on('close', (event) => {
    // Check again at the actual close, after the approval IPC has returned.
    if (protection.approved && hasActiveRequests()) protection.approved = false
    if (
      !protection.ready ||
      protection.approved ||
      protection.restarting?.() ||
      window.webContents.isDestroyed()
    )
      return
    event.preventDefault()
    window.webContents.send(IPC_CHANNELS.closeRequested)
  })
  window.webContents.on('render-process-gone', () => {
    protection.ready = false
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  return window
}

export async function loadWindow(window: BrowserWindow, recovery = false): Promise<void> {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}${recovery ? '#update-recovery' : ''}`
    )
  } else {
    await window.loadFile(
      join(outputDir, '../renderer/index.html'),
      recovery ? { hash: 'update-recovery' } : {}
    )
  }
}
