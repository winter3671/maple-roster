import { app, BrowserWindow, dialog, safeStorage } from 'electron'
import { join } from 'node:path'
import { createServices, type Services } from './bootstrap'
import { registerHandlers } from './ipc/register-handlers'
import { createWindow, loadWindow } from './window'
import { readNexonKey } from '../../backend/config/nexon-key'
import { NexonKeyStore } from '../../backend/config/nexon-key-store'
import { AUTOMATIC_BACKUP_INTERVAL } from '../../backend/modules/backup/automatic-backup.service'

let services: Services | undefined
let backupTimer: ReturnType<typeof setInterval> | undefined

// 테스트 실행은 일반 장부와 분리된 저장 위치를 지정할 수 있다.
app.setPath(
  'userData',
  process.env.MAPLE_ROSTER_DATA_DIR || join(app.getPath('appData'), 'maple-roster')
)

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0]
  if (window?.isMinimized()) window.restore()
  window?.show()
  window?.focus()
})

async function openApp(): Promise<void> {
  if (!services) throw new Error('저장소를 준비하지 못했습니다.')
  const window = createWindow()
  registerHandlers(window, services)
  await loadWindow(window)
}

app
  .whenReady()
  .then(async () => {
    if (!singleInstance) return
    const developmentKey = app.isPackaged
      ? { configured: false, issue: 'missing' as const }
      : readNexonKey(app.getAppPath())
    const keyStore = new NexonKeyStore(
      join(app.getPath('userData'), 'secrets', 'nexon-api-key.bin'),
      {
        available: () =>
          safeStorage.isEncryptionAvailable() &&
          (process.platform !== 'linux' ||
            safeStorage.getSelectedStorageBackend() !== 'basic_text'),
        encrypt: (key) => safeStorage.encryptString(key),
        decrypt: (data) => safeStorage.decryptString(data)
      },
      developmentKey
    )
    services = createServices(
      app.getVersion(),
      join(app.getPath('userData'), 'data', 'maple-roster.sqlite'),
      developmentKey,
      keyStore
    )
    services.automaticBackup.check()
    backupTimer = setInterval(() => services?.automaticBackup.check(), AUTOMATIC_BACKUP_INTERVAL)
    backupTimer.unref()
    await openApp()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void openApp().catch((error: unknown) => console.error('앱 실행에 실패했습니다.', error))
      }
    })
  })
  .catch((error: unknown) => {
    console.error('앱 실행에 실패했습니다.', error)
    dialog.showErrorBox(
      'Maple Roster 실행 오류',
      '앱 또는 로컬 저장소를 열지 못했습니다. 실행 중인 앱을 닫고 다시 시도해 주세요.'
    )
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  if (backupTimer) clearInterval(backupTimer)
  services?.automaticBackup.check()
  services?.close()
})
