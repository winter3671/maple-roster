import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { UpdateService } from '../../desktop/main/update.service'

class Engine extends EventEmitter {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowDowngrade = true
  allowPrerelease = true
  checkForUpdates = vi.fn(async () => {
    this.emit('update-available', { version: '0.3.0' })
  })
  downloadUpdate = vi.fn(async () => {
    this.emit('download-progress', { percent: 50 })
    this.emit('update-downloaded', { version: '0.3.0' })
  })
  quitAndInstall = vi.fn()
}
function setup(beforeInstall = vi.fn()) {
  const engine = new Engine(),
    queued: (() => void)[] = []
  const service = new UpdateService('0.2.0', engine, beforeInstall, (fn) => queued.push(fn))
  return { engine, service, beforeInstall, queued }
}
describe('사용자가 요청한 앱 업데이트', () => {
  it('개발 모드에서는 업데이트를 실행하지 않는다', async () => {
    const before = vi.fn(),
      service = new UpdateService('0.2.0', undefined, before)
    expect((await service.check()).phase).toBe('disabled')
    expect((await service.download()).phase).toBe('disabled')
    expect(() => service.install()).toThrow('다운로드가 완료')
    expect(before).not.toHaveBeenCalled()
  })
  it('자동 다운로드·종료 시 설치·이전 버전·사전 배포를 비활성화한다', () => {
    const { engine } = setup()
    expect([
      engine.autoDownload,
      engine.autoInstallOnAppQuit,
      engine.allowDowngrade,
      engine.allowPrerelease
    ]).toEqual([false, false, false, false])
    expect(engine.checkForUpdates).not.toHaveBeenCalled()
  })
  it('확인·다운로드·백업·명시적 재시작 순서로만 설치한다', async () => {
    const { engine, service, beforeInstall, queued } = setup()
    expect((await service.check()).phase).toBe('available')
    expect(engine.downloadUpdate).not.toHaveBeenCalled()
    expect((await service.download()).phase).toBe('downloaded')
    expect(engine.quitAndInstall).not.toHaveBeenCalled()
    expect(service.install().phase).toBe('installing')
    expect(beforeInstall).toHaveBeenCalledOnce()
    expect(engine.quitAndInstall).not.toHaveBeenCalled()
    expect(() => service.install()).toThrow()
    queued[0]()
    expect(engine.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true)
  })
  it('최신 버전인 경우 다운로드를 허용하지 않는다', async () => {
    const { engine, service } = setup()
    engine.checkForUpdates.mockImplementation(async () => {
      engine.emit('update-not-available', { version: '0.2.0' })
    })
    expect((await service.check()).phase).toBe('current')
    await expect(service.download()).rejects.toThrow('먼저 확인')
    expect(engine.downloadUpdate).not.toHaveBeenCalled()
  })
  it('확인 중 연속 클릭으로 중복 네트워크 요청을 만들지 않는다', async () => {
    const { engine, service } = setup()
    let finish!: () => void
    engine.checkForUpdates.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const first = service.check()
    expect((await service.check()).phase).toBe('checking')
    expect(engine.checkForUpdates).toHaveBeenCalledOnce()
    engine.emit('update-not-available')
    finish()
    expect((await first).phase).toBe('current')
  })
  it('다운로드 중 연속 클릭을 막고 진행률은 0~100으로 제한한다', async () => {
    const { engine, service } = setup()
    await service.check()
    let finish!: () => void
    engine.downloadUpdate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const first = service.download()
    expect((await service.download()).phase).toBe('downloading')
    expect((await service.check()).phase).toBe('downloading')
    expect(engine.downloadUpdate).toHaveBeenCalledOnce()
    engine.emit('download-progress', { percent: 150 })
    expect(service.status().progress).toBe(100)
    engine.emit('download-progress', { percent: NaN })
    expect(service.status().progress).toBe(0)
    engine.emit('update-downloaded', { version: '0.3.0' })
    finish()
    await first
  })
  it('백업 실패나 다른 작업이 진행 중이면 설치하지 않고 다운로드 상태를 유지한다', async () => {
    const { service, engine, beforeInstall, queued } = setup()
    await service.check()
    await service.download()
    beforeInstall.mockImplementationOnce(() => {
      throw new Error('Backup failed')
    })
    expect(() => service.install()).toThrow('Backup failed')
    expect(service.status().phase).toBe('downloaded')
    expect(queued).toHaveLength(0)
    expect(engine.quitAndInstall).not.toHaveBeenCalled()
    service.install()
    queued[0]()
    expect(engine.quitAndInstall).toHaveBeenCalledOnce()
  })
  it('조회와 다운로드 오류를 표시하고 원본 서버 응답은 노출하지 않으며 재시도한다', async () => {
    const { engine, service } = setup()
    engine.checkForUpdates.mockRejectedValueOnce(new Error('Internal URL/token'))
    expect((await service.check()).phase).toBe('error')
    expect(service.status().message).not.toContain('token')
    await service.check()
    engine.downloadUpdate.mockRejectedValueOnce(new Error('Network failed'))
    expect((await service.download()).phase).toBe('error')
    await service.check()
    expect((await service.download()).phase).toBe('downloaded')
  })
  it('설치 실패 이벤트는 오류를 표시하며 확인 전에는 설치를 허용하지 않는다', async () => {
    const { engine, service } = setup()
    expect(() => service.install()).toThrow()
    engine.emit('error', new Error('Installation failed'))
    expect(service.status().phase).toBe('error')
    expect(() => service.install()).toThrow()
    await service.check()
    expect(service.status().phase).toBe('available')
  })
})
