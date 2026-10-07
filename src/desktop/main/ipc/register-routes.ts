import { ipcMain, type BrowserWindow } from 'electron'
import { AppError, type ApiResult } from '../../../shared/errors'

type Route = readonly [channel: string, handle: (input: unknown) => unknown]

export function registerRoutes(window: BrowserWindow, routes: readonly Route[]): () => void {
  for (const [channel, handle] of routes) {
    ipcMain.handle(channel, async (event, input: unknown): Promise<ApiResult<unknown>> => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        return {
          ok: false,
          error: { code: 'PERMISSION_DENIED', message: '허용되지 않은 요청입니다.' }
        }
      }
      try {
        return { ok: true, data: await handle(input) }
      } catch (error) {
        if (error instanceof AppError)
          return { ok: false, error: { code: error.code, message: error.message } }
        console.error('장부 요청에 실패했습니다.', error)
        return {
          ok: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          }
        }
      }
    })
  }
  return () => {
    for (const [channel] of routes) ipcMain.removeHandler(channel)
  }
}
