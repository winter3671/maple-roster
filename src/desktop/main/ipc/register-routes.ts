import { ipcMain, type BrowserWindow } from 'electron'
import { AppError, type ApiResult } from '../../../shared/errors'
import { diagnosticCode, recordDiagnostic, recordRequestResult } from '../diagnostics'

type Route = readonly [channel: string, handle: (input: unknown) => unknown]
let activeRequests = 0
export function hasActiveRequests(): boolean {
  return activeRequests > 0
}
export function requireIdleClose(): void {
  if (activeRequests > 1)
    throw new AppError(
      'REQUEST_CONFLICT',
      '저장이나 API 작업이 진행 중입니다. 완료 후 다시 종료해 주세요.'
    )
}
export function requireIdleKeyChange(): void {
  if (activeRequests > 1)
    throw new AppError(
      'REQUEST_CONFLICT',
      'API 조회나 다른 작업이 진행 중입니다. 완료 후 API 계정을 변경해 주세요.'
    )
}
export function requireIdleUpdate(): void {
  if (activeRequests > 1)
    throw new AppError(
      'REQUEST_CONFLICT',
      'API 조회나 다른 작업이 진행 중입니다. 완료 후 업데이트를 적용해 주세요.'
    )
}
export function requireIdleRestore(): void {
  if (activeRequests > 1)
    throw new AppError(
      'REQUEST_CONFLICT',
      'API 조회나 다른 작업이 진행 중입니다. 완료 후 복원해 주세요.'
    )
}

export function registerRoutes(window: BrowserWindow, routes: readonly Route[]): () => void {
  for (const [channel, handle] of routes) {
    ipcMain.handle(channel, async (event, input: unknown): Promise<ApiResult<unknown>> => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        recordDiagnostic({ event: 'request.failed', operation: channel, code: 'PERMISSION_DENIED' })
        return {
          ok: false,
          error: { code: 'PERMISSION_DENIED', message: '허용되지 않은 요청입니다.' }
        }
      }
      activeRequests++
      const started = performance.now()
      try {
        const data = await handle(input)
        try {
          recordRequestResult(channel, data, performance.now() - started)
        } catch {
          /* Best effort. */
        }
        return { ok: true, data }
      } catch (error) {
        recordDiagnostic({
          event: 'request.failed',
          operation: channel,
          code: diagnosticCode(error),
          durationMs: performance.now() - started
        })
        if (error instanceof AppError)
          return { ok: false, error: { code: error.code, message: error.message } }
        return {
          ok: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          }
        }
      } finally {
        activeRequests--
      }
    })
  }
  return () => {
    for (const [channel] of routes) ipcMain.removeHandler(channel)
  }
}
