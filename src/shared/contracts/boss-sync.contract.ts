export interface SchedulerBoss {
  bossName: string
  difficulty: string
  isCleared: boolean
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
}
