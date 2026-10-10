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
import { DropRepository } from '../drops/drop.repository'
import { sumIntegers } from '../../domain/money'

export class HuntingService {
  constructor(
    private readonly repository: HuntingRepository,
    private readonly characters: CharacterRepository,
    private readonly ledger: LedgerRepository,
    private readonly transactions: UnitOfWork,
    private readonly drops: DropRepository,
    private readonly now = () => new Date()
  ) {}

  list(value: unknown): HuntingList {
    const income = this.drops.huntingIncome()
    const sessions = this.repository
      .list(parseRecordQuery(value))
      .map((session) => this.withSales(session, income))
    const fragmentSales = this.drops.huntingFragmentSales()
    return {
      sessions,
      summary: {
        ...summarizeHunting(sessions),
        solFragmentsSold: sumIntegers(
          sessions.map((session) => fragmentSales.get(session.id)?.quantity ?? 0)
        ),
        solFragmentsSaleIncome: sumIntegers(
          sessions.map((session) => fragmentSales.get(session.id)?.income ?? 0)
        )
      }
    }
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
          return this.withSales(existing)
        throw new AppError(
          'REQUEST_CONFLICT',
          '같은 저장 요청의 내용이 변경되었습니다. 입력을 확인한 뒤 다시 저장해 주세요.'
        )
      }
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      const timestamp = this.now().toISOString()
      const session: HuntingSession = {
        ...input,
        id,
        characterName: character.name,
        characterWorld: character.world,
        createdAt: timestamp,
        updatedAt: timestamp,
        saleIncome: 0,
        ...huntingProfit(input)
      }
      this.repository.insert(session)
      this.ledger.syncHunting(session)
      this.drops.syncHunting(session)
      return session
    })
  }

  update(value: unknown): HuntingSession {
    const raw = readObject(value)
    const input = parseHuntingInput(raw, getKstDate(this.now()))
    const id = readId(raw.id)
    return this.transactions.run(() => {
      const current = this.find(id)
      if (
        this.drops.hasSales({ kind: 'hunting', id }) &&
        (current.characterId !== input.characterId || current.date !== input.date)
      )
        throw new AppError(
          'DROP_IN_USE',
          '드랍 판매를 취소한 뒤 캐릭터나 사냥 날짜를 변경해 주세요.'
        )
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
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
      this.drops.syncHunting(session)
      return this.withSales(session)
    })
  }

  remove(value: unknown): null {
    const id = readId(value)
    return this.transactions.run(() => {
      this.find(id)
      if (this.drops.hasSales({ kind: 'hunting', id }))
        throw new AppError('DROP_IN_USE', '드랍 판매를 모두 취소한 뒤 사냥 기록을 삭제해 주세요.')
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
  private withSales(session: HuntingSession, income = this.drops.huntingIncome()): HuntingSession {
    const saleIncome = income.get(session.id) ?? 0
    return { ...session, saleIncome, ...huntingProfit(session, saleIncome) }
  }
}
