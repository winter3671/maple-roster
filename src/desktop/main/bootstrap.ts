import { getAppInfo } from '../../backend/modules/system/system.service'

export function createServices(version: string) {
  return { system: { getInfo: () => getAppInfo(version) } }
}

export type Services = ReturnType<typeof createServices>
