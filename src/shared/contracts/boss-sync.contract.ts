export interface SchedulerBoss {
  bossName: string
  difficulty: string
  isCleared: boolean
}
export type BossSyncApply = { previewId: string; incomeDate: string } & (
  | { mode?: 'selected'; runIds: string[] }
  | { mode: 'replace'; members: { bossName: string; difficulty: string; partySize: number }[] }
)
export interface BossSyncApplyResult {
  applied: number
  alreadyCleared: number
  added?: number
  removed?: number
}
export interface BossSyncPreview {
  id: string
  characterName: string
  characterWorld: string
  week: string
  queriedDate: string
  incomeDate: string
  expiresAt: string
  rows: {
    runId: string
    bossName: string
    difficulty: string
    partySize: number
    expectedShare: number
    state: 'ready' | 'alreadyCleared' | 'incomplete' | 'missing' | 'difficultyMismatch'
  }[]
  unmatchedClears: { bossName: string; difficulty: string }[]
  replacement: {
    members: {
      bossName: string
      difficulty: string
      partySize: number
      crystalPrice: number
      expectedShare: number
      isCleared: boolean
    }[]
    removed: { bossName: string; difficulty: string }[]
    blockedReasons: string[]
  }
}
