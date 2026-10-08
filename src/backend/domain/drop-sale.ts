import type { DropSaleInput } from '../../shared/contracts/drop.contract'
import { AppError } from '../../shared/errors'
import { safeNumber } from './money'

export function dropShare(
  input: Pick<
    DropSaleInput,
    'grossAmount' | 'feeAmount' | 'partySize' | 'shareMode' | 'manualShare'
  >
): number {
  const net = BigInt(input.grossAmount) - BigInt(input.feeAmount)
  if (net < 0n) throw new AppError('VALIDATION_ERROR', '수수료는 전체 판매대금보다 클 수 없습니다.')
  if (input.shareMode === 'manual') {
    if (input.manualShare === null || BigInt(input.manualShare) > net)
      throw new AppError('VALIDATION_ERROR', '내 분배금은 수수료를 뺀 판매대금 이하여야 합니다.')
    return input.manualShare
  }
  return safeNumber(net / BigInt(input.partySize))
}
export function estimatedDropValue(quantity: number, unitPrice: number): number {
  return safeNumber(BigInt(quantity) * BigInt(unitPrice))
}
