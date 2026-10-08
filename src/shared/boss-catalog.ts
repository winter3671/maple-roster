import { AppError } from './errors'

export interface WeeklyBoss {
  name: string
  difficulties: readonly string[]
  maxPartySize: number
  partySizeByDifficulty?: Readonly<Record<string, number>>
}

// KMS weekly bosses, verified 2026-10-08 against the official guides.
// https://maplestory.nexon.com/Guide/N23GameInformation/Articles/459
// https://maplestory.nexon.com/Guide/N23GameInformation/Articles/458
// Party capacity sources and exceptions are documented in docs/boss-catalog.md.
// Extreme Lotus has a 2-person limit; normal/hard Lotus remain 6-person bosses.
export const WEEKLY_BOSSES: readonly WeeklyBoss[] = [
  { name: '자쿰', difficulties: ['카오스'], maxPartySize: 6 },
  { name: '매그너스', difficulties: ['하드'], maxPartySize: 6 },
  { name: '피에르', difficulties: ['카오스'], maxPartySize: 6 },
  { name: '반반', difficulties: ['카오스'], maxPartySize: 6 },
  { name: '블러디퀸', difficulties: ['카오스'], maxPartySize: 6 },
  { name: '벨룸', difficulties: ['카오스'], maxPartySize: 6 },
  { name: '파풀라투스', difficulties: ['카오스'], maxPartySize: 6 },
  {
    name: '스우',
    difficulties: ['노멀', '하드', '익스트림'],
    maxPartySize: 6,
    partySizeByDifficulty: { 익스트림: 2 }
  },
  { name: '데미안', difficulties: ['노멀', '하드'], maxPartySize: 6 },
  { name: '가디언 엔젤 슬라임', difficulties: ['노멀', '카오스'], maxPartySize: 6 },
  { name: '루시드', difficulties: ['이지', '노멀', '하드'], maxPartySize: 6 },
  { name: '윌', difficulties: ['이지', '노멀', '하드'], maxPartySize: 6 },
  { name: '더스크', difficulties: ['노멀', '카오스'], maxPartySize: 6 },
  { name: '진 힐라', difficulties: ['노멀', '하드'], maxPartySize: 6 },
  { name: '듄켈', difficulties: ['노멀', '하드'], maxPartySize: 6 },
  { name: '선택받은 세렌', difficulties: ['노멀', '하드', '익스트림'], maxPartySize: 6 },
  { name: '감시자 칼로스', difficulties: ['이지', '노멀', '카오스', '익스트림'], maxPartySize: 6 },
  { name: '최초의 대적자', difficulties: ['이지', '노멀', '하드', '익스트림'], maxPartySize: 3 },
  { name: '카링', difficulties: ['이지', '노멀', '하드', '익스트림'], maxPartySize: 6 },
  { name: '벨로나', difficulties: ['이지', '노멀', '하드'], maxPartySize: 3 },
  { name: '찬란한 흉성', difficulties: ['노멀', '하드'], maxPartySize: 3 },
  { name: '림보', difficulties: ['노멀', '하드'], maxPartySize: 3 },
  { name: '발드릭스', difficulties: ['노멀', '하드'], maxPartySize: 3 },
  { name: '유피테르', difficulties: ['노멀', '하드'], maxPartySize: 3 }
]

export function findWeeklyBoss(name: string): WeeklyBoss | undefined {
  return WEEKLY_BOSSES.find((boss) => boss.name === name)
}

export function defaultBossDifficulty(name: string): string {
  const boss = findWeeklyBoss(name)
  return boss?.difficulties.includes('노멀') ? '노멀' : (boss?.difficulties[0] ?? '')
}

export function bossPartyLimit(name: string, difficulty: string): number {
  const boss = findWeeklyBoss(name)
  return boss?.partySizeByDifficulty?.[difficulty] ?? boss?.maxPartySize ?? 6
}

export function clampBossParty(name: string, difficulty: string, party: string): string {
  return String(Math.min(Number(party) || 1, bossPartyLimit(name, difficulty)))
}

export function validateBossParty(
  name: string,
  difficulty: string,
  partySize: number,
  previous?: { difficulty: string; partySize: number }
): void {
  if (previous?.difficulty === difficulty && previous.partySize === partySize) return
  const maximum = bossPartyLimit(name, difficulty)
  if (partySize > maximum)
    throw new AppError(
      'VALIDATION_ERROR',
      `${name} (${difficulty})은 최대 ${maximum}명까지 선택할 수 있습니다.`
    )
}

export function validateBossSelection(name: string, difficulty: string): void {
  const boss = findWeeklyBoss(name)
  if (!boss) throw new AppError('VALIDATION_ERROR', '주간 보스를 목록에서 선택해 주세요.')
  if (!boss.difficulties.includes(difficulty))
    throw new AppError('VALIDATION_ERROR', '선택한 보스의 주간 난이도를 목록에서 선택해 주세요.')
}

// Historical free-text records remain editable without rewriting their identity or settlement.
export function validateBossDifficultyChange(
  name: string,
  difficulty: string,
  previous: string
): void {
  if (difficulty !== previous) validateBossSelection(name, difficulty)
}
