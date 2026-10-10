import { app, BrowserWindow, dialog, safeStorage, nativeImage } from 'electron'
import { join } from 'node:path'
import { createServices, type Services } from './bootstrap'
import { registerHandlers } from './ipc/register-handlers'
import { createWindow, loadWindow } from './window'
import { readNexonKey } from '../../backend/config/nexon-key'
import { NexonKeyStore } from '../../backend/config/nexon-key-store'
import { AUTOMATIC_BACKUP_INTERVAL } from '../../backend/modules/backup/automatic-backup.service'
import electronUpdater from 'electron-updater'
import { UpdateService } from './update.service'
import { requireIdleUpdate } from './ipc/register-routes'
import { AppError } from '../../shared/errors'
import { CharacterAvatarService } from './character-avatar.service'
import { dataDirectory } from './data-directory'
import { NewerDatabaseError } from '../../backend/database/migrate'
import { backupForRecovery } from './recovery-backup'
import { registerRoutes } from './ipc/register-routes'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import { seedDevelopmentData } from './development-data'

let services: Services | undefined
let updates: UpdateService | undefined
let avatars: CharacterAvatarService | undefined
let backupTimer: ReturnType<typeof setInterval> | undefined

// 테스트 실행은 일반 장부와 분리된 저장 위치를 지정할 수 있다.
app.setPath(
  'userData',
  dataDirectory(app.getPath('appData'), app.isPackaged, process.env.MAPLE_ROSTER_DATA_DIR)
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
  if (!services || !updates || !avatars) throw new Error('저장소를 준비하지 못했습니다.')
  const window = createWindow()
  registerHandlers(window, services, updates, avatars)
  await loadWindow(window)
}

app
  .whenReady()
  .then(async () => {
    if (!singleInstance) return
    if (!app.isPackaged && !process.env.MAPLE_ROSTER_DATA_DIR) {
      await seedDevelopmentData(
        join(app.getPath('appData'), 'maple-roster'),
        app.getPath('userData')
      )
    }
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
    const databasePath = join(app.getPath('userData'), 'data', 'maple-roster.sqlite')
    try {
      services = createServices(app.getVersion(), databasePath, developmentKey, keyStore)
    } catch (error) {
      if (!(error instanceof NewerDatabaseError)) throw error
      updates = new UpdateService(
        app.getVersion(),
        app.isPackaged && process.platform === 'win32' ? electronUpdater.autoUpdater : undefined,
        () => {
          requireIdleUpdate()
          try {
            backupForRecovery(databasePath)
          } catch {
            throw new AppError(
              'DATABASE_ERROR',
              '업데이트 전 장부 백업을 저장하지 못했습니다. 저장 공간과 권한을 확인해 주세요.'
            )
          }
        }
      )
      const window = createWindow()
      const dispose = registerRoutes(window, [
        [IPC_CHANNELS.updatesStatus, () => updates!.status()],
        [IPC_CHANNELS.updatesCheck, () => updates!.check()],
        [IPC_CHANNELS.updatesDownload, () => updates!.download()],
        [IPC_CHANNELS.updatesInstall, () => updates!.install()]
      ])
      window.once('closed', dispose)
      await loadWindow(window, true)
      return
    }
    services.automaticBackup.check()
    avatars = new CharacterAvatarService(
      (id) => services!.characters.list().find((row) => row.id === id),
      (data) => nativeImage.createFromBuffer(data)
    )
    updates = new UpdateService(
      app.getVersion(),
      app.isPackaged && process.platform === 'win32' ? electronUpdater.autoUpdater : undefined,
      () => {
        requireIdleUpdate()
        const backup = services!.automaticBackup.check(true)
        if (backup.error)
          throw new AppError(
            'DATABASE_ERROR',
            '업데이트 전 장부 백업을 저장하지 못했습니다. 저장 공간과 폴더 권한을 확인해 주세요.'
          )
      }
    )
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
