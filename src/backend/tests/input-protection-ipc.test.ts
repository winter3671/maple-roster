import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import {
  hasActiveRequests,
  registerRoutes,
  requireIdleClose
} from '../../desktop/main/ipc/register-routes'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }))

describe('종료 승인 IPC 보호', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  const frame = {}
  const contents = { mainFrame: frame }
  const window = { webContents: contents } as unknown as BrowserWindow
  const event = { sender: contents, senderFrame: frame }
  function handler(channel: string) {
    const registered = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel)
    if (!registered) throw Error('등록되지 않은 테스트 경로')
    return registered[1]
  }

  it('다른 저장 요청이 진행 중이면 종료 승인을 거부하고 완료 후 허용한다', async () => {
    let release!: () => void
    const dispose = registerRoutes(window, [
      [
        'test:save',
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          })
      ],
      [
        'test:close',
        () => {
          requireIdleClose()
          return null
        }
      ]
    ])
    const save = handler('test:save')(event as never)
    expect(hasActiveRequests()).toBe(true)
    expect(await handler('test:close')(event as never)).toMatchObject({
      ok: false,
      error: { code: 'REQUEST_CONFLICT' }
    })
    release()
    await save
    expect(hasActiveRequests()).toBe(false)
    expect(await handler('test:close')(event as never)).toEqual({ ok: true, data: null })
    expect(hasActiveRequests()).toBe(false)
    dispose()
  })
  it('다른 창과 하위 프레임의 종료 승인을 거부한다', async () => {
    const approve = vi.fn(() => null)
    const dispose = registerRoutes(window, [['test:close', approve]])
    expect(await handler('test:close')({ sender: {}, senderFrame: frame } as never)).toMatchObject({
      ok: false,
      error: { code: 'PERMISSION_DENIED' }
    })
    expect(
      await handler('test:close')({ sender: contents, senderFrame: {} } as never)
    ).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } })
    expect(approve).not.toHaveBeenCalled()
    expect(hasActiveRequests()).toBe(false)
    dispose()
  })
  it('저장 실패 후에도 진행 중 요청 수를 해제한다', async () => {
    const dispose = registerRoutes(window, [
      [
        'test:save',
        () => {
          throw new Error('검증용 저장 오류')
        }
      ]
    ])
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await handler('test:save')(event as never)).toMatchObject({ ok: false })
    expect(hasActiveRequests()).toBe(false)
    log.mockRestore()
    dispose()
  })
})
