import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { AppError } from '../../shared/errors'
import { registerRoutes, hasActiveRequests } from '../../desktop/main/ipc/register-routes'
import { registerDiagnosticHandlers } from '../../desktop/main/ipc/diagnostics.handlers'
import {
  setDiagnosticRecorder,
  type DiagnosticEvent,
  type DiagnosticLog
} from '../../desktop/main/diagnostics'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  dialog: { showSaveDialog: vi.fn() }
}))
const frame = {},
  contents = { mainFrame: frame }
const window = { webContents: contents } as unknown as BrowserWindow
const event = { sender: contents, senderFrame: frame }
function handler(channel: string) {
  const route = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel)
  if (!route) throw Error('테스트 경로 없음')
  return route[1]
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => setDiagnosticRecorder())
describe('진단 IPC와 오류 수집', () => {
  it('실패 코드만 기록하고 원본 입력·오류를 노출하지 않는다', async () => {
    const rows: DiagnosticEvent[] = []
    setDiagnosticRecorder((row) => rows.push(row))
    registerRoutes(window, [
      [
        'characters:create',
        () => {
          throw new AppError('VALIDATION_ERROR', 'synthetic-private')
        }
      ]
    ])
    expect(
      await handler('characters:create')(event as never, { key: 'synthetic-private' })
    ).toMatchObject({ ok: false })
    expect(rows[0]).toMatchObject({
      event: 'request.failed',
      operation: 'characters:create',
      code: 'VALIDATION_ERROR'
    })
    expect(JSON.stringify(rows)).not.toContain('synthetic-private')
    expect(hasActiveRequests()).toBe(false)
  })
  it('기록기가 실패해도 정상 요청 결과와 요청 수는 유지한다', async () => {
    setDiagnosticRecorder(() => {
      throw Error('로그 실패')
    })
    registerRoutes(window, [['weekly:sync', () => ({ characters: [{ error: '테스트 오류' }] })]])
    expect(await handler('weekly:sync')(event as never)).toEqual({
      ok: true,
      data: { characters: [{ error: '테스트 오류' }] }
    })
    expect(hasActiveRequests()).toBe(false)
  })
  it('허용한 화면 오류 종류만 받고 반복 보고는 분당 5건으로 제한한다', async () => {
    const rows: DiagnosticEvent[] = []
    setDiagnosticRecorder((row) => rows.push(row))
    registerDiagnosticHandlers(window, {} as DiagnosticLog)
    for (let n = 0; n < 10; n++) await handler('diagnostics:report')(event as never, 'page')
    expect(rows.filter((row) => row.event === 'renderer.failed')).toHaveLength(5)
    expect(
      await handler('diagnostics:report')(event as never, { message: 'synthetic-private' })
    ).toMatchObject({ ok: false })
    expect(JSON.stringify(rows)).not.toContain('synthetic-private')
  })
  it('다른 프레임은 진단 파일 저장을 호출할 수 없고 파일 선택 취소는 null이다', async () => {
    const exportFile = vi.fn(async () => 3)
    registerDiagnosticHandlers(window, { exportFile } as unknown as DiagnosticLog)
    expect(
      await handler('diagnostics:export')({ sender: {}, senderFrame: frame } as never)
    ).toMatchObject({ ok: false })
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' })
    expect(await handler('diagnostics:export')(event as never)).toEqual({ ok: true, data: null })
    expect(exportFile).not.toHaveBeenCalled()
  })
})
