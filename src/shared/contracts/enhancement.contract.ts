export interface PotentialRecord {
  source?: 'potential' | 'cube'
  id: string
  characterName: string
  date: string
  kind: string
  itemName: string
  itemLevel: number | null
  beforeGrade: string | null
}
export interface EnhancementPreview {
  id: string
  date: string
  expiresAt: string
  accountLabel: string
  characters: { id: string; name: string; world: string }[]
  rows: {
    id: string
    characterName: string
    characterId: string | null
    kind: string
    count: number
    amount: number | null
    items: string[]
    warning: string | null
    source?: 'potential' | 'cube'
    details?: {
      itemName: string
      itemLevel: number | null
      grade: string | null
      count: number
      unitCost: number | null
      total: number | null
    }[]
  }[]
  alreadyImported: number
  excluded: number
}
export interface EnhancementApply {
  previewId: string
  confirmed: boolean
  rows: { id: string; characterId: string; amount: number }[]
}
export interface EnhancementApplied {
  expenses: number
  records: number
  amount: number
}
