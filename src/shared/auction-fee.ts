import { AppError } from './errors'
import { readInteger } from './validation'

export type AuctionFeeRate = 3 | 5

export function readAuctionFeeRate(value: unknown): AuctionFeeRate {
  if (value !== 3 && value !== 5)
    throw new AppError('VALIDATION_ERROR', '판매 수수료는 3% 또는 5%를 선택해 주세요.')
  return value
}

export function auctionFee(grossAmount: number, rate: AuctionFeeRate): number {
  readInteger(grossAmount, '전체 판매대금')
  readAuctionFeeRate(rate)
  return Number((BigInt(grossAmount) * BigInt(rate)) / 100n)
}
