import type { AppApi } from '../../shared/contracts/app-api'

export function getBridge(): AppApi {
  if (!window.maple) throw new Error('Electron 앱에서 실행해 주세요.')
  return window.maple
}
