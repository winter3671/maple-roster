import { readDate } from '../dates'
import { AppError } from '../errors'
import { readId, readInteger, readObject, readText } from '../validation'

export const EXPENSE_CATEGORIES = ['장비 구매', '강화', '큐브', '아이템 구매', '기타'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export interface ExpenseInput {
  characterId: string
  date: string
  category: ExpenseCategory
  amount: number
  notes: string
}
export type ExpenseCreate = ExpenseInput & { requestId: string }
export type ExpenseUpdate = ExpenseInput & { id: string }
export interface Expense extends ExpenseInput {
  id: string
  characterWorld: string
  createdAt: string
  updatedAt: string
}
export function parseExpenseInput(value: unknown, today: string): ExpenseInput {
  const raw = readObject(value)
  const date = readDate(raw.date)
  if (date > today)
    throw new AppError('VALIDATION_ERROR', '지출 날짜는 오늘까지 입력할 수 있습니다.')
  if (!EXPENSE_CATEGORIES.includes(raw.category as ExpenseCategory))
    throw new AppError('VALIDATION_ERROR', '지출 분류를 선택해 주세요.')
  const amount = readInteger(raw.amount, '지출 금액')
  if (amount === 0) throw new AppError('VALIDATION_ERROR', '지출 금액은 1 메소 이상 입력해 주세요.')
  return {
    characterId: readId(raw.characterId),
    date,
    category: raw.category as ExpenseCategory,
    amount,
    notes: readText(raw.notes, '메모', 500, false, true)
  }
}
