export interface WeeklyContent {
  name: string
  count: number
  maximum: number
}
export interface WeeklyCharacter {
  characterId: string
  name: string
  world: string
  connected: boolean
  fetchedAt?: string
  contents?: WeeklyContent[]
  error?: string
}
export interface WeeklyPeriod {
  week: string
  end: string
  characters: WeeklyCharacter[]
}
export interface WeeklyOverview extends WeeklyPeriod {
  previous: WeeklyPeriod
}
