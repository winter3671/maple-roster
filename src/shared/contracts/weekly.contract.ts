export interface WeeklyContent {
  name: string
  count: number
  maximum: number
}
export interface WeeklyCharacter {
  characterId: string
  name: string
  world: string
  isHidden: boolean
  connected: boolean
  fetchedAt?: string
  contents?: WeeklyContent[]
  error?: string
}
export interface WeeklyOverview {
  week: string
  end: string
  characters: WeeklyCharacter[]
}
