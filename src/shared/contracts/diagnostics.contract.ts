export interface DiagnosticStatus {
  files: number
  bytes: number
  writeIssue: boolean
  dropped: number
}
export interface DiagnosticSaved {
  filePath: string
  count: number
}
export type RendererIssue = 'page' | 'error' | 'unhandled-rejection'
