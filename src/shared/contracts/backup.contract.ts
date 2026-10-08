export interface BackupCounts {
  characters: number
  bossRuns: number
  huntingSessions: number
  dropLots: number
  dropSales: number
  ledgerEntries: number
  templates: number
}

export interface BackupPreview {
  id: string
  fileName: string
  createdAt: string
  expiresAt: string
  incoming: BackupCounts
  current: BackupCounts
}

export interface BackupSaved {
  filePath: string
}

export interface BackupRestored {
  recoveryPath: string
  counts: BackupCounts
}
