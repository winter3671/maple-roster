import { getKstDate, readDate } from '../dates'
import { AppError } from '../errors'
import { readId, readInteger, readObject, readText } from '../validation'

export interface HuntingInput {
  characterId: string
  date: string
  minutes: number
  mesos: number
  cost: number
  solFragments: number
  nodestones: number
  notes: string
}
export interface HuntingCreate extends HuntingInput {
  requestId: string
}
export interface HuntingUpdate extends HuntingInput {
  id: string
}
export interface HuntingSession extends HuntingInput {
  id: string
  characterName: string
  characterWorld: string
  createdAt: string
  updatedAt: string
  net: number
  hourlyNet: number | null
}
export interface HuntingSummary {
  income: number
  expense: number
  net: number
  count: number
  minutes: number
  hourlyNet: number | null
  solFragments: number
  nodestones: number
}
export interface HuntingList {
  sessions: HuntingSession[]
  summary: HuntingSummary
}

export function parseHuntingInput(value: unknown, today = getKstDate()): HuntingInput {
  const input = readObject(value)
  const date = readDate(input.date)
  if (date > today) throw new AppError('VALIDATION_ERROR', '미래 날짜의 사냥은 기록할 수 없습니다.')
  return {
    characterId: readId(input.characterId),
    date,
    minutes: readInteger(input.minutes, '사냥 시간', 1440),
    mesos: readInteger(input.mesos, '획득 메소'),
    cost: readInteger(input.cost, '소모 비용'),
    solFragments: readInteger(input.solFragments ?? 0, '솔 에르다 조각 수량', 1000000),
    nodestones: readInteger(input.nodestones ?? 0, '코어 젬스톤 수량', 1000000),
    notes: readText(input.notes ?? '', '메모', 500, false, true)
  }
}
