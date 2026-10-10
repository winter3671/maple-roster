import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
