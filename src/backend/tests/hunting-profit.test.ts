import { describe, expect, it } from 'vitest'
import { huntingProfit, summarizeHunting } from '../domain/hunting-profit'
import { hourlyProfit, sumIntegers } from '../domain/money'
import { getKstDate } from '../../shared/dates'
import type { HuntingInput } from '../../shared/contracts/hunting.contract'

const session = (minutes: number, mesos: number, cost = 0): HuntingInput => ({
  characterId: '',
  date: '2026-10-07',
  minutes,
  mesos,
  cost,
  solFragments: 0,
  nodestones: 0,
  notes: ''
})

describe('사냥 정산', () => {
  it('소모 비용을 뺀 수익으로 시간당 금액을 계산한다', () => {
    expect(huntingProfit({ minutes: 120, mesos: 150000000, cost: 10000000 })).toEqual({
      net: 140000000,
      hourlyNet: 70000000
    })
  })
  it('회차별 평균 대신 총순수익을 총시간으로 나눈다', () => {
    expect(summarizeHunting([session(60, 100), session(180, 900)]).hourlyNet).toBe(250)
  })
  it('시간 미기록 회차는 금액 합계에만 포함한다', () => {
    const summary = summarizeHunting([session(60, 100), session(180, 900), session(0, 1000)])
    expect(summary).toMatchObject({ income: 2000, net: 2000, minutes: 240, hourlyNet: 250 })
    expect(huntingProfit(session(0, 100))).toMatchObject({ hourlyNet: null })
    expect(summarizeHunting([]).hourlyNet).toBeNull()
  })
  it('적자와 소수 메소 내림을 처리한다', () => {
    expect(hourlyProfit(-1, 7)).toBe(-9)
    expect(hourlyProfit(1, 7)).toBe(8)
  })
  it('획득 아이템 수량을 실제 수입에 더하지 않는다', () => {
    expect(
      summarizeHunting([{ ...session(60, 100), solFragments: 10, nodestones: 5 }])
    ).toMatchObject({ income: 100, solFragments: 10, nodestones: 5 })
  })
  it('획득 메소와 시간당 메소는 판매 수익과 과거 비용을 제외한다', () => {
    expect(
      summarizeHunting([
        { ...session(30, 100, 50), saleIncome: 900 },
        { ...session(60, 500), saleIncome: 1000 },
        session(0, 1000)
      ])
    ).toMatchObject({ mesos: 1600, hourlyMesos: 400, income: 3500 })
    expect(summarizeHunting([])).toMatchObject({
      mesos: 0,
      hourlyMesos: null,
      solFragments: 0,
      solFragmentsSold: 0,
      solFragmentsSaleIncome: 0
    })
  })
  it('정수 연산 중간값을 안전하게 처리하고 범위 초과를 거부한다', () => {
    expect(hourlyProfit(Number.MAX_SAFE_INTEGER, 60)).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => hourlyProfit(Number.MAX_SAFE_INTEGER, 1)).toThrow('금액 범위')
    expect(() => sumIntegers([Number.MAX_SAFE_INTEGER, 1])).toThrow('금액 범위')
  })
  it('호스트 시간대에 관계없이 한국 날짜를 사용한다', () => {
    expect(getKstDate(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07')
    expect(getKstDate(new Date('2026-10-06T14:59:59Z'))).toBe('2026-10-06')
  })
})
