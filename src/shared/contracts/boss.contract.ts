import { AppError } from '../errors'
import { getKstDate, readDate } from '../dates'
import { bossWeek } from '../boss-period'
import { readId, readInteger, readObject, readText } from '../validation'

export interface BossPresetInput {
  characterId: string
  bossName: string
  difficulty: string
  partySize: number
  crystalPrice?: number
}
export interface BossPreset extends BossPresetInput {
  crystalPrice: number
  id: string
  bossKey: string
  characterName: string
  characterWorld: string
  createdAt: string
  updatedAt: string
}
export interface BossPresetUpdate extends BossPresetInput {
  id: string
}
export interface BossQuery {
  date: string
  characterId?: string
}
export interface CrystalInput {
  runId: string
  date: string
  amount: number
}
export interface CrystalSettlement {
  id: string
  date: string
  amount: number
}
export interface BossRun extends BossPresetInput {
  crystalPrice: number
  id: string
  bossKey: string
  characterName: string
  characterWorld: string
  week: string
  isCleared: boolean
  notes: string
  expectedShare: number
  settlement: CrystalSettlement | null
  createdAt: string
  updatedAt: string
}
export interface BossRunUpdate {
  id: string
  bossName?: string
  difficulty: string
  partySize: number
  crystalPrice?: number
  notes: string
  incomeDate?: string
}
export interface BossRunCreate extends BossPresetInput {
  date: string
  notes?: string
}
export interface BossList {
  week: string
  runs: BossRun[]
  summary: {
    count: number
    cleared: number
    sold: number
    expected: number
    clearedUnsold: number
    settled: number
    remaining: number
  }
}

export function parseBossDetails(value: unknown) {
  const input = readObject(value)
  const partySize = readInteger(input.partySize, '파티 인원', 6)
  if (partySize < 1) throw new AppError('VALIDATION_ERROR', '파티 인원은 1~6명으로 입력해 주세요.')
  return {
    difficulty: readText(input.difficulty, '난이도', 40),
    partySize,
    crystalPrice: readInteger(input.crystalPrice ?? 0, '결정석 가격')
  }
}
export function parseBossPreset(value: unknown): BossPresetInput {
  const input = readObject(value)
  return {
    ...parseBossDetails(input),
    characterId: readId(input.characterId),
    bossName: readText(input.bossName, '보스 이름', 60)
  }
}
export function parseBossQuery(value: unknown): BossQuery {
  const input = readObject(value)
  const date = readDate(input.date)
  if (date < '2000-01-06')
    throw new AppError('VALIDATION_ERROR', '보스 주차는 2000년 1월 6일 이후로 조회해 주세요.')
  return {
    date,
    ...(input.characterId === undefined || input.characterId === ''
      ? {}
      : { characterId: readId(input.characterId) })
  }
}
export function parseCrystal(value: unknown, today = getKstDate()): CrystalInput {
  const input = readObject(value)
  const date = readDate(input.date)
  if (date > today)
    throw new AppError('VALIDATION_ERROR', '판매일은 오늘 이후로 입력할 수 없습니다.')
  return { runId: readId(input.runId), date, amount: readInteger(input.amount, '실제 수령액') }
}
export function currentBossWeek() {
  return bossWeek(getKstDate())
}
