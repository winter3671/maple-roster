import type { AppInfo } from '../../../shared/contracts/app-api'

// Electron의 app 객체 대신 필요한 값만 전달받는다.
export function getAppInfo(version: string): AppInfo {
  return { name: 'Maple Roster', version, stage: 'hunting-ledger' }
}
