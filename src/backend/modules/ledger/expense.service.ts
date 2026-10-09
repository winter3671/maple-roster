import type { DatabaseSync } from 'node:sqlite'
import { getKstDate } from '../../../shared/dates'
import { AppError } from '../../../shared/errors'
import { readId, readObject } from '../../../shared/validation'
import {
  parseExpenseInput,
  type Expense,
  type ExpenseCategory
} from '../../../shared/contracts/expense.contract'
import { UnitOfWork } from '../../database/unit-of-work'
import { CharacterRepository } from '../characters/character.repository'
import { LedgerRepository } from './ledger.repository'

export class ExpenseService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly characters: CharacterRepository,
    private readonly ledger: LedgerRepository,
    private readonly transactions: UnitOfWork,
    private readonly now = () => new Date()
  ) {}
  private find(id: string): Expense | undefined {
    const row = this.database.prepare('SELECT * FROM manual_expenses WHERE id=?').get(id)
    return row
      ? {
          id: String(row.id),
          characterId: String(row.character_id),
          characterWorld: String(row.world_snapshot),
          date: String(row.occurred_on),
          category: row.category as ExpenseCategory,
          amount: Number(row.amount),
          currency: row.currency as 'meso' | 'maplePoint',
          pointAmount: row.point_amount == null ? null : Number(row.point_amount),
          pointsPer100m: row.points_per_100m == null ? null : Number(row.points_per_100m),
          notes: String(row.notes),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at)
        }
      : undefined
  }
  private require(id: string): Expense {
    const expense = this.find(id)
    if (!expense)
      throw new AppError(
        'SESSION_NOT_FOUND',
        '지출 기록을 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      )
    return expense
  }
  create(value: unknown): Expense {
    return this.save(value, false)
  }
  update(value: unknown): Expense {
    return this.save(value, true)
  }
  private save(value: unknown, updating: boolean): Expense {
    const raw = readObject(value),
      input = parseExpenseInput(raw, getKstDate(this.now()))
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
      const expense: Expense = {
        ...input,
        id,
        characterWorld:
          current?.characterId === character.id ? current.characterWorld : character.world,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp
      }
      this.database
        .prepare(
          `INSERT INTO manual_expenses (id, character_id, world_snapshot, occurred_on, category, amount, notes, created_at, updated_at, currency, point_amount, points_per_100m)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET character_id=excluded.character_id, world_snapshot=excluded.world_snapshot,
        occurred_on=excluded.occurred_on, category=excluded.category, amount=excluded.amount, notes=excluded.notes, updated_at=excluded.updated_at,
        currency=excluded.currency, point_amount=excluded.point_amount, points_per_100m=excluded.points_per_100m`
        )
        .run(
          id,
          expense.characterId,
          expense.characterWorld,
          expense.date,
          expense.category,
          expense.amount,
          expense.notes,
          expense.createdAt,
          timestamp,
          expense.currency ?? 'meso',
          expense.pointAmount ?? null,
          expense.pointsPer100m ?? null
        )
      this.ledger.syncExpense(expense)
      return expense
    })
  }
  remove(value: unknown): null {
    const id = readId(value)
    return this.transactions.run(() => {
      this.require(id)
      this.database.prepare('DELETE FROM manual_expenses WHERE id=?').run(id)
      return null
    })
  }
}
