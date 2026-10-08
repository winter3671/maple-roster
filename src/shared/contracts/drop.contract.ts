import { AppError } from '../errors'
import { getKstDate, readDate } from '../dates'
import { readId, readInteger, readObject, readText } from '../validation'

export interface DropSource {
  kind: 'hunting' | 'boss'
  id: string
}
export interface DropLotInput {
  source: DropSource
  itemName: string
  quantity: number
  estimatedUnitPrice: number
  notes: string
}
export interface DropLotCreate extends DropLotInput {
  requestId: string
}
export interface BossDropBatchCreate {
  source: { kind: 'boss'; id: string }
  items: (Omit<DropLotInput, 'source'> & { requestId: string })[]
}
export interface DropLotUpdate {
  id: string
  quantity: number
  estimatedUnitPrice: number
  notes: string
}
export interface DropLot extends DropLotInput {
  id: string
  characterId: string
  characterName: string
  characterWorld: string
  acquiredDate: string
  partySize: number
  managedKind: 'sol_fragment' | 'nodestone' | null
  soldQuantity: number
  remaining: number
  estimatedValue: number
  saleIncome: number
  createdAt: string
  updatedAt: string
}
export interface DropSaleInput {
  lotId: string
  date: string
  quantity: number
  grossAmount: number
  feeAmount: number
  partySize: number
  shareMode: 'equal' | 'manual'
  manualShare: number | null
}
export interface DropSaleCreate extends DropSaleInput {
  requestId: string
}
export interface DropSaleUpdate extends DropSaleInput {
  id: string
}
export interface DropSale extends DropSaleInput {
  id: string
  netShare: number
  estimatedUnitPrice: number
  createdAt: string
  updatedAt: string
}
export interface DropList {
  boss?: { name: string; difficulty: string }
  lots: DropLot[]
  sales: DropSale[]
  summary: { remainingQuantity: number; estimatedValue: number; saleIncome: number }
}
export function parseDropSource(value: unknown): DropSource {
  const input = readObject(value)
  if (input.kind !== 'hunting' && input.kind !== 'boss')
    throw new AppError('VALIDATION_ERROR', '드랍 획득 출처를 확인해 주세요.')
  return { kind: input.kind, id: readId(input.id) }
}
export function positiveQuantity(value: unknown): number {
  const quantity = readInteger(value, '아이템 수량', 1000000)
  if (quantity === 0)
    throw new AppError('VALIDATION_ERROR', '아이템 수량은 1개 이상 입력해 주세요.')
  return quantity
}
export function parseDropLot(value: unknown): DropLotInput {
  const input = readObject(value)
  return {
    source: parseDropSource(input.source),
    itemName: readText(input.itemName, '아이템 이름', 80),
    quantity: positiveQuantity(input.quantity),
    estimatedUnitPrice: readInteger(input.estimatedUnitPrice, '예상 단가'),
    notes: readText(input.notes ?? '', '메모', 500, false, true)
  }
}
export function parseDropSale(value: unknown, today = getKstDate()): DropSaleInput {
  const input = readObject(value)
  if (input.shareMode !== 'equal' && input.shareMode !== 'manual')
    throw new AppError('VALIDATION_ERROR', '분배 방식을 확인해 주세요.')
  const partySize = readInteger(input.partySize, '분배 인원', 6)
  if (partySize === 0)
    throw new AppError('VALIDATION_ERROR', '분배 인원은 1~6명으로 입력해 주세요.')
  const date = readDate(input.date)
  if (date > today)
    throw new AppError('VALIDATION_ERROR', '판매일은 오늘 이후로 입력할 수 없습니다.')
  return {
    lotId: readId(input.lotId),
    date,
    quantity: positiveQuantity(input.quantity),
    grossAmount: readInteger(input.grossAmount, '전체 판매대금'),
    feeAmount: readInteger(input.feeAmount, '전체 수수료'),
    partySize,
    shareMode: input.shareMode,
    manualShare:
      input.shareMode === 'manual' ? readInteger(input.manualShare, '내 실제 분배금') : null
  }
}
