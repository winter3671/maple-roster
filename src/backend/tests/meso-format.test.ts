import { describe, expect, it } from 'vitest'
import { formatKoreanMeso } from '../../shared/meso-format'

describe('메소 단위 표시', () => {
  it.each([
    [0, '0 메소'],
    [9999, '9,999 메소'],
    [10000, '1만 메소'],
    [5725459, '572만 5,459 메소'],
    [100000000, '1억 메소'],
    [123456789, '1억 2,345만 6,789 메소'],
    [100000001, '1억 1 메소'],
    [1000000000000, '1조 메소'],
    [Number.MAX_SAFE_INTEGER, '9,007조 1,992억 5,474만 991 메소']
  ])('%s 메소를 손실 없이 단위로 나눈다', (value, expected) => {
    expect(formatKoreanMeso(value)).toBe(expected)
  })
  it('잘못된 금액을 반올림해 표시하지 않는다', () => {
    for (const value of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(formatKoreanMeso(value)).toBeNull()
  })
})
