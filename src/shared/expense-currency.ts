import { AppError } from './errors'
import { readInteger } from './validation'

export function pointsToMesos(points: unknown, pointsPer100m: unknown): number {
  const amount = readInteger(points, '사용한 메이플포인트')
  const rate = readInteger(pointsPer100m, '1억 메소당 메이플포인트')
  if (!amount || !rate)
    throw new AppError('VALIDATION_ERROR', '메이플포인트와 환전비는 1 이상 입력해 주세요.')
  const converted = (BigInt(amount) * 100000000n) / BigInt(rate)
  if (converted < 1n || converted > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AppError('VALIDATION_ERROR', '환산 지출은 1 메소 이상 안전한 정수 범위여야 합니다.')
  return Number(converted)
}
