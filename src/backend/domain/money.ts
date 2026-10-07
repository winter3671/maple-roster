import { AppError } from '../../shared/errors'

export function safeNumber(value: bigint): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result))
    throw new AppError(
      'VALIDATION_ERROR',
      '계산 결과가 안전하게 처리할 수 있는 금액 범위를 넘었습니다.'
    )
  return result
}

export function sumIntegers(values: number[]): number {
  return safeNumber(values.reduce((sum, value) => sum + BigInt(value), 0n))
}

export function hourlyProfit(net: number, minutes: number): number | null {
  if (minutes === 0) return null
  const numerator = BigInt(net) * 60n
  const denominator = BigInt(minutes)
  const quotient = numerator / denominator
  return safeNumber(quotient - (numerator < 0n && numerator % denominator !== 0n ? 1n : 0n))
}
