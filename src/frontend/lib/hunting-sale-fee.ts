import type { AuctionFeeRate } from '../../shared/auction-fee'

const key = 'maple-roster:hunting-sale-fee-rate'

export function readHuntingSaleFee(): AuctionFeeRate {
  try {
    return localStorage.getItem(key) === '5' ? 5 : 3
  } catch {
    return 3
  }
}

export function rememberHuntingSaleFee(rate: AuctionFeeRate): void {
  try {
    localStorage.setItem(key, String(rate))
  } catch {
    // The sale can still be saved when local preferences are unavailable.
  }
}
