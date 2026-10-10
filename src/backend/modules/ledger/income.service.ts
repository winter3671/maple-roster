import type { DatabaseSync } from 'node:sqlite'
import { getKstDate } from '../../../shared/dates'
import { AppError } from '../../../shared/errors'
import { readId, readObject } from '../../../shared/validation'
import {
  parseIncomeInput,
  type Income,
  type IncomeCategory
} from '../../../shared/contracts/income.contract'
import { UnitOfWork } from '../../database/unit-of-work'
import { CharacterRepository } from '../characters/character.repository'
import { LedgerRepository } from './ledger.repository'

export class IncomeService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly characters: CharacterRepository,
    private readonly ledger: LedgerRepository,
    private readonly transactions: UnitOfWork,
    private readonly now = () => new Date()
  ) {}
  private find(id: string): Income | undefined {
    const row = this.database.prepare('SELECT * FROM manual_incomes WHERE id=?').get(id)
    return row
      ? {
          id: String(row.id),
          characterId: String(row.character_id),
          characterWorld: String(row.world_snapshot),
          date: String(row.occurred_on),
          category: row.category as IncomeCategory,
          amount: Number(row.amount),
          notes: String(row.notes),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at)
        }
      : undefined
  }
  private require(id: string): Income {
    const income = this.find(id)
    if (!income)
      throw new AppError(
        'SESSION_NOT_FOUND',
        '수익 기록을 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      )
    return income
  }
  create(value: unknown): Income {
    return this.save(value, false)
  }
  update(value: unknown): Income {
    return this.save(value, true)
  }
  private save(value: unknown, updating: boolean): Income {
    const raw = readObject(value),
      input = parseIncomeInput(raw, getKstDate(this.now()))
    const id = readId(updating ? raw.id : raw.requestId)
    return this.transactions.run(() => {
      const current = updating ? this.require(id) : this.find(id)
      if (!updating && current) {
        if (
          Object.entries(input).every(
            ([key, field]) => current[key as keyof typeof input] === field
          )
        )
          return current
        throw new AppError(
          'REQUEST_CONFLICT',
          '같은 저장 요청의 내용이 변경되었습니다. 다시 저장해 주세요.'
        )
      }
      const character = this.characters.find(input.characterId)
      if (!character) throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      const timestamp = this.now().toISOString()
      const income: Income = {
        ...input,
        id,
        characterWorld:
          current?.characterId === character.id ? current.characterWorld : character.world,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp
      }
      this.database
        .prepare(
          `INSERT INTO manual_incomes (id, character_id, world_snapshot, occurred_on, category, amount, notes, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET character_id=excluded.character_id, world_snapshot=excluded.world_snapshot,
        occurred_on=excluded.occurred_on, category=excluded.category, amount=excluded.amount, notes=excluded.notes, updated_at=excluded.updated_at`
        )
        .run(
          id,
          income.characterId,
          income.characterWorld,
          income.date,
          income.category,
          income.amount,
          income.notes,
          income.createdAt,
          timestamp
        )
      this.ledger.syncIncome(income)
      return income
    })
  }
  remove(value: unknown): null {
    const id = readId(value)
    return this.transactions.run(() => {
      this.require(id)
      this.database.prepare('DELETE FROM manual_incomes WHERE id=?').run(id)
      return null
    })
  }
}
