import { app, dialog, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Services } from '../bootstrap'
import { registerRoutes } from './register-routes'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import { saveAtomicTextFile } from '../../../backend/files/atomic-text-file'

export function registerLedgerHandlers(window: BrowserWindow, services: Services): () => void {
  return registerRoutes(window, [
    [IPC_CHANNELS.ledgerCreateIncome, (input) => services.incomes.create(input)],
    [IPC_CHANNELS.ledgerUpdateIncome, (input) => services.incomes.update(input)],
    [IPC_CHANNELS.ledgerRemoveIncome, (input) => services.incomes.remove(input)],
    [IPC_CHANNELS.ledgerCreateExpense, (input) => services.expenses.create(input)],
    [IPC_CHANNELS.ledgerUpdateExpense, (input) => services.expenses.update(input)],
    [IPC_CHANNELS.ledgerRemoveExpense, (input) => services.expenses.remove(input)],
    [IPC_CHANNELS.dashboardSummary, (input) => services.ledger.dashboard(input)],
    [IPC_CHANNELS.ledgerList, (input) => services.ledger.list(input)],
    [
      IPC_CHANNELS.ledgerExportCsv,
      async (input) => {
        const snapshot = services.ledger.exportCsv(input)
        const result = await dialog.showSaveDialog(window, {
          title: '거래 내역 CSV 내보내기',
          defaultPath: join(
            app.getPath('documents'),
            `maple-roster-ledger-${snapshot.query.from}-${snapshot.query.to}${snapshot.query.characterId ? '-character' : ''}.csv`
          ),
          filters: [{ name: '거래 내역 CSV', extensions: ['csv'] }]
        })
        if (result.canceled || !result.filePath) return null
        saveAtomicTextFile(result.filePath, snapshot.content, '.csv', 'CSV')
        return { filePath: result.filePath, count: snapshot.count }
      }
    ]
  ])
}
