import { app, BrowserWindow } from 'electron'
import { createServices } from './bootstrap'
import { registerHandlers } from './ipc/register-handlers'
import { createWindow, loadWindow } from './window'

async function openApp(): Promise<void> {
  const window = createWindow()
  registerHandlers(window, createServices(app.getVersion()))
  await loadWindow(window)
}

app
  .whenReady()
  .then(async () => {
    await openApp()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void openApp().catch((error: unknown) => console.error('앱 실행에 실패했습니다.', error))
      }
    })
  })
  .catch((error: unknown) => {
    console.error('앱 실행에 실패했습니다.', error)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
