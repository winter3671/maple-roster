import { AppError } from '../errors'
import { readInteger, readObject, readText } from '../validation'

export const MAX_ROSTER_BOSSES = 12
export interface BossMember {
  bossName: string
  difficulty: string
  partySize: number
}
export interface BossTemplateInput {
  name: string
  members: BossMember[]
}
export interface BossTemplate extends BossTemplateInput {
  id: string
}
export interface BossRoster {
  characterId: string
  templateId: string | null
  name: string
  customized: boolean
  members: BossMember[]
}
export interface BossRosterState {
  templates: BossTemplate[]
  rosters: BossRoster[]
}

export function parseBossMembers(value: unknown): BossMember[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ROSTER_BOSSES)
    throw new AppError('VALIDATION_ERROR', '보스 묶음은 1~12개로 구성해 주세요.')
  const members = value.map((entry) => {
    const row = readObject(entry)
    const partySize = readInteger(row.partySize, '클리어 인원', 6)
    if (partySize < 1) throw new AppError('VALIDATION_ERROR', '클리어 인원은 1명 이상입니다.')
    return {
      bossName: readText(row.bossName, '보스', 60),
      difficulty: readText(row.difficulty, '난이도', 40),
      partySize
    }
  })
  if (new Set(members.map((row) => row.bossName)).size !== members.length)
    throw new AppError('VALIDATION_ERROR', '같은 보스를 묶음에 중복해서 넣을 수 없습니다.')
  return members
}
