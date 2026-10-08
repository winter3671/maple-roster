import { describe, expect, it } from 'vitest'
import { dashboardStats } from '../domain/dashboard'
import type { LedgerEntry, LedgerList } from '../../shared/contracts/ledger.contract'

const entry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: 'id',
  characterId: 'character',
  characterName: '캐릭터',
  characterWorld: '루나',
  huntingSessionId: 'hunt',
  crystalSettlementId: null,
  dropSaleId: null,
  source: 'hunting',
  activity: 'hunting',
  direction: 'income',
  amount: 100,
  date: '2026-10-08',
  ...overrides
})
const list = (entries: LedgerEntry[]): LedgerList => {
  const income = entries
    .filter((row) => row.direction === 'income')
    .reduce((sum, row) => sum + row.amount, 0)
  const expense = entries
    .filter((row) => row.direction === 'expense')
    .reduce((sum, row) => sum + row.amount, 0)
  return { entries, summary: { income, expense, net: income - expense, count: entries.length } }
}
describe('대시보드 수익 집계', () => {
  it('지원 날짜의 마지막 연도에서도 조회 종료일에 멈춘다', () => {
    expect(dashboardStats(list([]), { from: '9999-12-31', to: '9999-12-31' }).trend).toHaveLength(1)
    expect(dashboardStats(list([]), { from: '9999-01-01', to: '9999-12-31' }).trend).toHaveLength(
      12
    )
  })
  it('일별 빈 날짜를 포함하고 수입·지출·손실과 분류별 합계가 일치한다', () => {
    const stats = dashboardStats(
      list([
        entry(),
        entry({ direction: 'expense', amount: 200 }),
        entry({ date: '2026-10-10', source: 'crystal', amount: 300 }),
        entry({ date: '2026-10-10', source: 'drop', amount: 50 })
      ]),
      { from: '2026-10-08', to: '2026-10-10' }
    )
    expect(stats.summary).toEqual({ income: 450, expense: 200, net: 250, count: 4 })
    expect(stats.trend).toEqual([
      { period: '2026-10-08', income: 100, expense: 200, net: -100, count: 2 },
      { period: '2026-10-09', income: 0, expense: 0, net: 0, count: 0 },
      { period: '2026-10-10', income: 350, expense: 0, net: 350, count: 2 }
    ])
    expect(stats.sources.map((row) => row.net)).toEqual([-100, 300, 50])
  })
  it('캐릭터 ID로 합치되 과거 서버는 함께 표시하고 순수익순으로 비교한다', () => {
    const stats = dashboardStats(
      list([
        entry({ characterWorld: '레드' }),
        entry({ characterWorld: '루나', direction: 'expense', amount: 200 }),
        entry({ characterId: 'other', characterName: '캐릭터', amount: 50 })
      ]),
      { from: '2026-10-08', to: '2026-10-08' }
    )
    expect(stats.characters).toHaveLength(2)
    expect(stats.characters[0]).toMatchObject({ characterId: 'other', net: 50 })
    expect(stats.characters[1]).toMatchObject({
      characterId: 'character',
      worlds: ['레드', '루나'],
      net: -100,
      count: 2
    })
  })
  it('62일 초과 기간은 월별로 묶고 기록 없는 달도 포함한다', () => {
    const stats = dashboardStats(
      list([
        entry({ date: '2026-01-31' }),
        entry({ date: '2026-04-01', direction: 'expense', amount: 25 })
      ]),
      { from: '2026-01-31', to: '2026-04-01' }
    )
    expect(stats.granularity).toBe('day')
    const monthly = dashboardStats(
      list([
        entry({ date: '2026-01-01' }),
        entry({ date: '2026-04-01', direction: 'expense', amount: 25 })
      ]),
      { from: '2026-01-01', to: '2026-04-01' }
    )
    expect(monthly.granularity).toBe('month')
    expect(monthly.trend.map((row) => [row.period, row.net])).toEqual([
      ['2026-01', 100],
      ['2026-02', 0],
      ['2026-03', 0],
      ['2026-04', -25]
    ])
  })
  it('빈 조회와 최근 5건을 처리하며 정수 범위 초과를 거부한다', () => {
    const empty = dashboardStats(list([]), { from: '2026-10-08', to: '2026-10-08' })
    expect(empty.characters).toEqual([])
    expect(empty.trend[0]).toMatchObject({ net: 0, count: 0 })
    const entries = Array.from({ length: 7 }, (_, index) => entry({ id: String(index) }))
    expect(dashboardStats(list(entries), { from: '2026-10-08', to: '2026-10-08' }).recent).toEqual(
      entries.slice(0, 5)
    )
    expect(() =>
      dashboardStats(list([entry({ amount: Number.MAX_SAFE_INTEGER }), entry()]), {
        from: '2026-10-08',
        to: '2026-10-08'
      })
    ).toThrow('범위')
  })
})
