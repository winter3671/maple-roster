import { dialog, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import { AppError } from '../../../shared/errors'
import { DiagnosticLog, recordDiagnostic } from '../diagnostics'
import { registerRoutes } from './register-routes'

export function registerDiagnosticHandlers(window: BrowserWindow, log: DiagnosticLog) {
  let reported = 0,
    intervalStart = Date.now()
  return registerRoutes(window, [
    [IPC_CHANNELS.diagnosticsStatus, () => log.status()],
    [
      IPC_CHANNELS.diagnosticsReport,
      (kind) => {
        if (!['page', 'error', 'unhandled-rejection'].includes(kind as string))
          throw new AppError('VALIDATION_ERROR', '진단 항목을 확인해 주세요.')
        if (Date.now() - intervalStart >= 60000) {
          intervalStart = Date.now()
          reported = 0
        }
        if (reported++ < 5)
          recordDiagnostic({ event: 'renderer.failed', operation: kind as string })
        return null
      }
    ],
    [
      IPC_CHANNELS.diagnosticsExport,
      async () => {
        const selection = await dialog.showSaveDialog(window, {
          title: '진단 로그 저장',
          defaultPath: `maple-roster-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: '진단 로그', extensions: ['json'] }]
        })
        if (selection.canceled || !selection.filePath) return null
        try {
          return { filePath: selection.filePath, count: await log.exportFile(selection.filePath) }
        } catch {
          throw new AppError(
            'DATABASE_ERROR',
            '진단 로그를 저장하지 못했습니다. 저장 공간과 폴더 권한을 확인해 주세요.'
          )
        }
      }
    ]
  ])
}
