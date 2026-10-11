import { describe, expect, it } from 'vitest'
import { missingCharacter, resolveLedgerPage, ViewStateStore } from '../../shared/view-state'

const month = () => ({ from: '2026-10-01', to: '2026-10-11' })
describe('실행 중 조회 조건 기억', () => {
  it('화면이 다시 열려도 첫 기본값 대신 적용한 조건을 반환한다', () => {
    const store = new ViewStateStore()
    store.read('dashboardQuery', month)
    store.update('dashboardQuery', month, {
      from: '2026-09-01',
      to: '2026-09-30',
      characterId: 'selected'
    })
    expect(store.read('dashboardQuery', () => ({ from: '2026-11-01', to: '2026-11-30' }))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      characterId: 'selected'
    })
  })
  it('장부별 조건과 주간·월간 보스 조건을 독립적으로 유지한다', () => {
    const store = new ViewStateStore()
    store.update('huntingQuery', month, { from: '2026-09-01', to: '2026-09-02' })
    expect(store.read('dashboardQuery', month)).toEqual(month())
    store.update('weeklyBossQuery', () => ({ date: '2026-10-08', cycle: 'weekly' }), {
      date: '2026-10-01',
      cycle: 'weekly'
    })
    expect(
      store.read('monthlyBossQuery', () => ({ date: '2026-10-01', cycle: 'monthly' })).cycle
    ).toBe('monthly')
  })
  it('재실행에 해당하는 새 저장소는 현재 기간과 기본 화면으로 시작한다', () => {
    const old = new ViewStateStore()
    old.update('bossView', () => 'overview', 'monthly')
    old.update('dashboardQuery', month, { from: '2026-09-01', to: '2026-09-30' })
    const next = new ViewStateStore()
    expect(next.read('bossView', () => 'overview')).toBe('overview')
    expect(next.read('dashboardQuery', month)).toEqual(month())
  })
  it('페이지 변경은 조회 객체를 유지하고 최신 상태를 기준으로 업데이트한다', () => {
    const store = new ViewStateStore()
    const initial = () => ({ query: month(), page: 1 })
    const query = store.read('ledger', initial).query
    store.update('ledger', initial, (current) => ({ ...current, page: current.page + 1 }))
    store.update('ledger', initial, (current) => ({ ...current, page: current.page + 1 }))
    expect(store.read('ledger', initial)).toEqual({ query, page: 3 })
    expect(store.read('ledger', initial).query).toBe(query)
    store.update('ledger', initial, { query: month(), page: 1 })
    expect(store.read('ledger', initial).page).toBe(1)
  })
  it('기본값은 한 번만 계산하고 같은 스냅샷을 유지한다', () => {
    const store = new ViewStateStore()
    let calls = 0
    const initial = () => {
      calls++
      return month()
    }
    const first = store.read('huntingQuery', initial)
    expect(store.read('huntingQuery', initial)).toBe(first)
    expect(calls).toBe(1)
  })
  it('화면 구독 해제는 기억한 상태를 지우지 않고 불필요한 알림도 발생시키지 않는다', () => {
    const store = new ViewStateStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)
    store.update('huntingMode', () => 'quick', 'detail')
    store.update(
      'huntingMode',
      () => 'quick',
      (current) => current
    )
    unsubscribe()
    store.update('bossView', () => 'overview', 'weekly')
    expect(calls).toBe(1)
    expect(store.read('huntingMode', () => 'quick')).toBe('detail')
  })
  it('목록 로딩·실패 시 선택을 지우지 않고 성공한 목록에서만 삭제 여부를 판단한다', () => {
    expect(missingCharacter('selected', [], false)).toBe(false)
    expect(missingCharacter('selected', [{ id: 'selected' }], true)).toBe(false)
    expect(missingCharacter(undefined, [], true)).toBe(false)
    expect(missingCharacter('selected', [], true)).toBe(true)
  })
  it('실제 반환된 페이지를 기억하되 이전 조회 응답이 새 조건을 덮어쓰지 않는다', () => {
    const query = month(),
      current = { query, page: 5 }
    expect(resolveLedgerPage(current, query, 5, 2)).toEqual({ query, page: 2 })
    expect(resolveLedgerPage(current, query, 5, 5)).toBe(current)
    expect(resolveLedgerPage(current, { ...query }, 5, 1)).toBe(current)
    expect(resolveLedgerPage(current, query, 4, 1)).toBe(current)
  })
})
