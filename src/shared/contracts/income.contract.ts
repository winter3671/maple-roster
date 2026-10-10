import { readDate } from '../dates'
import { AppError } from '../errors'
import { readId, readInteger, readObject, readText } from '../validation'

export const INCOME_CATEGORIES = ['아이템 판매', '메소 수령', '이벤트', '기타'] as const
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export interface IncomeInput {
  characterId: string
  date: string
  category: IncomeCategory
  amount: number
  notes: string
}
export type IncomeCreate = IncomeInput & { requestId: string }
export type IncomeUpdate = IncomeInput & { id: string }
export interface Income extends IncomeInput {
  id: string
  characterWorld: string
  createdAt: string
  updatedAt: string
}
export function parseIncomeInput(value: unknown, today: string): IncomeInput {
  const raw = readObject(value),
    date = readDate(raw.date)
  if (date > today)
    throw new AppError('VALIDATION_ERROR', '수익 날짜는 오늘까지 입력할 수 있습니다.')
  if (!INCOME_CATEGORIES.includes(raw.category as IncomeCategory))
    throw new AppError('VALIDATION_ERROR', '수익 분류를 선택해 주세요.')
  const amount = readInteger(raw.amount, '수익 금액')
  if (!amount) throw new AppError('VALIDATION_ERROR', '수익 금액은 1 메소 이상 입력해 주세요.')
  return {
    characterId: readId(raw.characterId),
    date,
    category: raw.category as IncomeCategory,
    amount,
    notes: readText(raw.notes, '메모', 500, false, true)
  }
}
