import { describe, expect, it } from 'vitest'
import { InputProtectionStore } from '../../shared/input-protection'

describe('입력 보호와 실행 중 임시 입력', () => {
  it('복원할 입력은 원본과 분리하여 보관한다', () => {
    const store = new InputProtectionStore()
    const value = { amount: '100', notes: ['초안'] }
    store.remember('income', value, '{}')
    value.notes.push('추가')
    expect(store.read('income')).toEqual({
      value: { amount: '100', notes: ['초안'] },
      baseline: '{}'
    })
  })
  it('메뉴에서 내려간 초안은 종료 확인 대상에 남는다', () => {
    const store = new InputProtectionStore()
    store.remember('hunting-quick', { mesos: '100' }, '{}')
    expect(store.snapshot()).toEqual({ dirty: false, busy: false })
    expect(store.snapshot(undefined, true)).toEqual({ dirty: true, busy: false })
  })
  it('저장하거나 취소한 초안은 다시 복원되지 않는다', () => {
    const store = new InputProtectionStore()
    store.remember('expense', { amount: '200' }, '{}')
    store.forget('expense')
    expect(store.read('expense')).toBeUndefined()
    expect(store.snapshot(undefined, true).dirty).toBe(false)
  })
  it('수정창 닫기는 그 창 안의 입력만 확인한다', () => {
    const store = new InputProtectionStore()
    const inside = {}
    const outside = {}
    const scope = { contains: (element: unknown) => element === inside }
    store.inputs.set('background', { element: outside, dirty: true, busy: true, discard: () => {} })
    store.inputs.set('modal', { element: inside, dirty: false, busy: false, discard: () => {} })
    expect(store.snapshot(scope)).toEqual({ dirty: false, busy: false })
    expect(store.snapshot()).toEqual({ dirty: true, busy: true })
  })
  it('저장 중에는 변경 여부와 관계없이 이동을 차단한다', () => {
    const store = new InputProtectionStore()
    store.inputs.set('saving', { element: null, dirty: false, busy: true, discard: () => {} })
    expect(store.snapshot().busy).toBe(true)
  })
  it('변경 버리기는 다른 화면의 임시 기록을 삭제하지 않는다', () => {
    const store = new InputProtectionStore()
    const inside = {}
    const scope = { contains: (element: unknown) => element === inside }
    store.remember('hunting-quick', { mesos: '100' }, '{}')
    let discarded = 0
    store.inputs.set('modal', {
      element: inside,
      dirty: true,
      busy: false,
      discard: () => {
        discarded++
      }
    })
    store.discard(scope)
    expect(discarded).toBe(1)
    expect(store.read('hunting-quick')).toBeDefined()
  })
  it('앱을 새로 실행하면 임시 기록이 없다', () => {
    const first = new InputProtectionStore()
    first.remember('character', { name: '초안' }, '{}')
    const restarted = new InputProtectionStore()
    expect(restarted.read('character')).toBeUndefined()
  })
})
