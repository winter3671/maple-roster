import { dialog, app, type BrowserWindow } from 'electron'
import { basename, join } from 'node:path'
import { IPC_CHANNELS as C } from '../../../shared/ipc/channels'
import { readBackupFile, saveBackupFile } from '../../../backend/modules/backup/backup.files'
import type { Services } from '../bootstrap'
import { registerRoutes, requireIdleRestore } from './register-routes'

export function registerBackupHandlers(window: BrowserWindow, services: Services): () => void {
  return registerRoutes(window, [
    [C.backupAutomaticStatus, () => services.automaticBackup.status()],
    [C.backupAutomaticNow, () => services.automaticBackup.check(true)],
    [
      C.backupExport,
      async () => {
        const result = await dialog.showSaveDialog(window, {
          title: '장부 JSON 백업',
          defaultPath: join(
            app.getPath('documents'),
            `maple-roster-${new Date().toISOString().slice(0, 10)}.json`
          ),
          filters: [{ name: 'Maple Roster 백업', extensions: ['json'] }]
        })
        if (result.canceled || !result.filePath) return null
        saveBackupFile(result.filePath, services.backup.export())
        return { filePath: result.filePath }
      }
    ],
    [
      C.backupSelect,
      async () => {
        services.backup.cancel()
        const result = await dialog.showOpenDialog(window, {
          title: '복원할 장부 백업 선택',
          properties: ['openFile'],
          filters: [{ name: 'Maple Roster 백업', extensions: ['json'] }]
        })
        if (result.canceled || !result.filePaths[0]) return null
        return services.backup.prepare(
          readBackupFile(result.filePaths[0]),
          basename(result.filePaths[0])
        )
      }
    ],
    [
      C.backupRestore,
      (input) => {
        requireIdleRestore()
        const result = services.backup.restore(input)
        services.bossSync.invalidatePreviews()
        return result
      }
    ],
    [
      C.backupCancel,
      () => {
        services.backup.cancel()
        return null
      }
    ]
  ])
}
