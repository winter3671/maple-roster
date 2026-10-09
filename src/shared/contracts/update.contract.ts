export interface UpdateStatus {
  currentVersion: string
  latestVersion: string | null
  phase:
    | 'disabled'
    | 'idle'
    | 'checking'
    | 'current'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'installing'
    | 'error'
  progress: number
  message: string
}
