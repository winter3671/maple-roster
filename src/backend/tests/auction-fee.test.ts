import { describe, expect, it } from 'vitest'
import { auctionFee } from '../../shared/auction-fee'

describe('판매 수수료 정수 계산', () => {
  it('0메소와 소수점 수수료 경계를 처리한다', () => {
    expect(auctionFee(0, 3)).toBe(0)
    expect(auctionFee(33, 3)).toBe(0)
    expect(auctionFee(34, 3)).toBe(1)
    expect(auctionFee(19, 5)).toBe(0)
    expect(auctionFee(20, 5)).toBe(1)
  })
  it('큰 판매금액에도 부동소수점 오차 없이 계산한다', () => {
    expect(auctionFee(Number.MAX_SAFE_INTEGER, 3)).toBe(270215977642229)
    expect(auctionFee(Number.MAX_SAFE_INTEGER, 5)).toBe(450359962737049)
  })
})
