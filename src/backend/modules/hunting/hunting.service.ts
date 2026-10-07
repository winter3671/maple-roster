import { getKstDate } from '../../../shared/dates'
import {
  parseHuntingInput,
  type HuntingSession,
  type HuntingList
} from '../../../shared/contracts/hunting.contract'
import { parseRecordQuery } from '../../../shared/contracts/ledger.contract'
import { AppError } from '../../../shared/errors'
import { readId, readObject } from '../../../shared/validation'
import { huntingProfit, summarizeHunting } from '../../domain/hunting-profit'
import { UnitOfWork } from '../../database/unit-of-work'
import { CharacterRepository } from '../characters/character.repository'
import { LedgerRepository } from '../ledger/ledger.repository'
import { HuntingRepository } from './hunting.repository'

export class HuntingService {
  constructor(
    private readonly repository: HuntingRepository,
    private readonly characters: CharacterRepository,
    private readonly ledger: LedgerRepository,
    private readonly transactions: UnitOfWork,
    private readonly now = () => new Date()
  ) {}

  list(value: unknown): HuntingList {
    const sessions = this.repository.list(parseRecordQuery(value))
    return { sessions, summary: summarizeHunting(sessions) }
  }

  create(value: unknown): HuntingSession {
    const raw = readObject(value)
    const input = parseHuntingInput(raw, getKstDate(this.now()))
    const id = readId(raw.requestId)
    return this.transactions.run(() => {
      const existing = this.repository.find(id)
      if (existing) {
        if (
          Object.entries(input).every(
            ([key, field]) => existing[key as keyof typeof input] === field
          )
        )
          return existing
        throw new AppError(
          'REQUEST_CONFLICT',
          '같은 저장 요청의 내용이 변경되었습니다. 입력을 확인한 뒤 다시 저장해 주세요.'
        )
      }
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      if (character.isHidden)
        throw new AppError(
          'VALIDATION_ERROR',
          '숨긴 캐릭터는 다시 표시한 뒤 새 기록을 추가해 주세요.'
        )
      const timestamp = this.now().toISOString()
      const session: HuntingSession = {
        ...input,
        id,
        characterName: character.name,
        characterWorld: character.world,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...huntingProfit(input)
      }
      this.repository.insert(session)
      this.ledger.syncHunting(session)
      return session
    })
  }

  update(value: unknown): HuntingSession {
    const raw = readObject(value)
    const input = parseHuntingInput(raw, getKstDate(this.now()))
    const id = readId(raw.id)
    return this.transactions.run(() => {
      const current = this.find(id)
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      if (character.isHidden && input.characterId !== current.characterId)
        throw new AppError('VALIDATION_ERROR', '숨긴 캐릭터로 기록을 옮길 수 없습니다.')
      const session: HuntingSession = {
        ...current,
        ...input,
        characterName: character.name,
        characterWorld:
          input.characterId === current.characterId ? current.characterWorld : character.world,
        updatedAt: this.now().toISOString(),
        ...huntingProfit(input)
      }
      this.repository.update(session)
      this.ledger.syncHunting(session)
      return session
    })
  }

  remove(value: unknown): null {
    const id = readId(value)
    return this.transactions.run(() => {
      this.find(id)
      this.repository.remove(id)
      return null
    })
  }

  private find(id: string): HuntingSession {
    const session = this.repository.find(id)
    if (!session)
      throw new AppError(
        'SESSION_NOT_FOUND',
        '사냥 기록을 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      )
    return session
  }
}
