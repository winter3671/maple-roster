export interface AppInfo {
  name: string
  version: string
  stage: 'foundation'
}

export interface AppApi {
  system: {
    getInfo: () => Promise<AppInfo>
  }
}
