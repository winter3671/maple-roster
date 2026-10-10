import { shell, type BrowserWindow } from 'electron'
import { AppError } from '../../../shared/errors'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import type { Services } from '../bootstrap'
import { registerRoutes, requireIdleKeyChange } from './register-routes'

export function registerNexonHandlers(window: BrowserWindow, services: Services): () => void {
  function change(operation: () => unknown) {
    requireIdleKeyChange()
    const result = operation()
    services.bossSync.invalidatePreviews()
    return result
  }
  return registerRoutes(window, [
    [
      IPC_CHANNELS.nexonOpenKeyGuide,
      async () => {
        try {
          await shell.openExternal('https://openapi.nexon.com/ko/guide/prepare-in-advance/')
          return null
        } catch {
          throw new AppError(
            'API_UNAVAILABLE',
            '공식 가이드를 열지 못했습니다. 기본 브라우저 설정을 확인해 주세요.'
          )
        }
      }
    ],
    [IPC_CHANNELS.nexonSyncProfiles, (input) => services.nexon.syncProfiles(input)],
    [IPC_CHANNELS.nexonUnlink, (input) => services.nexon.unlink(input)],
    [IPC_CHANNELS.nexonSaveKey, (input) => change(() => services.nexon.saveKey(input))],
    [IPC_CHANNELS.nexonActivateKey, (input) => change(() => services.nexon.activateKey(input))],
    [IPC_CHANNELS.nexonRenameKey, (input) => change(() => services.nexon.renameKey(input))],
    [IPC_CHANNELS.nexonRemoveKey, (input) => change(() => services.nexon.removeKey(input))],
    [IPC_CHANNELS.nexonStatus, () => services.nexon.status()],
    [IPC_CHANNELS.nexonList, () => services.nexon.list()],
    [IPC_CHANNELS.nexonBasic, (input) => services.nexon.basic(input)],
    [IPC_CHANNELS.nexonRegister, (input) => services.nexon.register(input)],
    [IPC_CHANNELS.nexonRegisterMany, (input) => services.nexon.registerMany(input)]
  ])
}
