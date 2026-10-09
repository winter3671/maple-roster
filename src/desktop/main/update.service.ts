import type { UpdateStatus } from '../../shared/contracts/update.contract'
import { AppError } from '../../shared/errors'

export interface UpdateEngine {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  allowPrerelease: boolean
  on(event: string, listener: (...args: any[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(silent: boolean, restart: boolean): void
}

export class UpdateService {
  private state: UpdateStatus
  private running = false
  constructor(
    version: string,
    private readonly engine: UpdateEngine | undefined,
    private readonly beforeInstall: () => void,
    private readonly schedule: (action: () => void) => void = (action) => {
      setImmediate(action)
    }
  ) {
    this.state = {
      currentVersion: version,
      latestVersion: null,
      phase: engine ? 'idle' : 'disabled',
      progress: 0,
      message: engine
        ? '업데이트 확인 버튼을 눌러 최신 버전을 확인하세요.'
        : '앱 내 업데이트는 Windows 설치 버전에서 사용할 수 있습니다.'
    }
    if (!engine) return
    engine.autoDownload = false
    engine.autoInstallOnAppQuit = false
    engine.allowDowngrade = false
    engine.allowPrerelease = false
    engine.on('update-available', (info: { version: string }) => {
      this.state = {
        ...this.state,
        latestVersion: info.version,
        phase: 'available',
        progress: 0,
        message: `v${info.version} 업데이트를 다운로드할 수 있습니다.`
      }
    })
    engine.on('update-not-available', () => {
      this.state = {
        ...this.state,
        latestVersion: null,
        phase: 'current',
        progress: 0,
        message: '현재 최신 버전을 사용하고 있습니다.'
      }
    })
    engine.on('download-progress', (info: { percent: number }) => {
      if (this.state.phase !== 'downloading') return
      this.state.progress = Number.isFinite(info.percent)
        ? Math.min(100, Math.max(0, info.percent))
        : 0
    })
    engine.on('update-downloaded', (info: { version: string }) => {
      this.state = {
        ...this.state,
        latestVersion: info.version,
        phase: 'downloaded',
        progress: 100,
        message: '다운로드가 완료되었습니다. 재시작하여 업데이트를 적용하세요.'
      }
    })
    engine.on('error', () => this.fail())
  }
  status(): UpdateStatus {
    return { ...this.state }
  }
  async check(): Promise<UpdateStatus> {
    if (!this.engine || this.running || ['downloaded', 'installing'].includes(this.state.phase))
      return this.status()
    this.running = true
    this.state = {
      ...this.state,
      phase: 'checking',
      latestVersion: null,
      progress: 0,
      message: 'GitHub Releases에서 최신 버전을 확인하고 있습니다…'
    }
    try {
      await this.engine.checkForUpdates()
    } catch {
      this.fail()
    } finally {
      this.running = false
    }
    return this.status()
  }
  async download(): Promise<UpdateStatus> {
    if (!this.engine || this.running) return this.status()
    if (this.state.phase !== 'available')
      throw new AppError('REQUEST_CONFLICT', '업데이트를 먼저 확인해 주세요.')
    this.running = true
    this.state = {
      ...this.state,
      phase: 'downloading',
      progress: 0,
      message: '업데이트 파일을 다운로드하고 있습니다…'
    }
    try {
      await this.engine.downloadUpdate()
    } catch {
      this.fail()
    } finally {
      this.running = false
    }
    return this.status()
  }
  install(): UpdateStatus {
    if (!this.engine || this.state.phase !== 'downloaded' || this.running)
      throw new AppError('REQUEST_CONFLICT', '다운로드가 완료된 업데이트가 없습니다.')
    this.beforeInstall()
    this.state = {
      ...this.state,
      phase: 'installing',
      message: '장부 백업을 저장했습니다. 앱을 재시작하여 업데이트합니다…'
    }
    this.schedule(() => {
      try {
        this.engine!.quitAndInstall(true, true)
      } catch {
        this.fail()
      }
    })
    return this.status()
  }
  private fail(): void {
    this.state = {
      ...this.state,
      phase: 'error',
      progress: 0,
      message:
        '업데이트를 완료하지 못했습니다. 인터넷 연결과 GitHub Releases의 정식 릴리스·업데이트 파일을 확인한 뒤 다시 시도해 주세요.'
    }
  }
}
