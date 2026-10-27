import { describe, expect, it } from 'vitest'
import { batchTaskStatus, TaskNotificationStore } from '../../shared/task-notifications'

describe('작업 알림', () => {
  it('시작 자동 조회는 메뉴 이동을 허용하고 종료 보호와 일반 작업 잠금은 유지한다', () => {
    const store = new TaskNotificationStore()
    const background = store.begin('자동 조회', { background: true })
    expect(store.isRunning()).toBe(true)
    expect(store.isRunning(true)).toBe(false)
    const save = store.begin('저장')
    expect(store.isRunning(true)).toBe(true)
    save.finish('success', '저장 완료')
    expect(store.isRunning(true)).toBe(false)
    background.finish('success', '조회 완료')
    expect(store.isRunning()).toBe(false)
  })
  it('시작 즉시 이동·종료 보호 대상이 되고 완료 시 해제된다', () => {
    const store = new TaskNotificationStore(() => 100)
    const task = store.begin('조회')
    expect(store.isRunning()).toBe(true)
    task.finish('success', '완료')
    expect(store.isRunning()).toBe(false)
    expect(store.snapshot()[0]).toMatchObject({ status: 'success', expiresAt: 8100 })
  })
  it('여러 작업 중 하나만 끝나도 나머지는 계속 보호한다', () => {
    const store = new TaskNotificationStore()
    const first = store.begin('조회'),
      second = store.begin('백업')
    first.finish('success', '완료')
    expect(store.isRunning()).toBe(true)
    store.dismiss(store.snapshot()[1].id)
    expect(store.isRunning()).toBe(true)
    second.finish('error', '실패')
    expect(store.isRunning()).toBe(false)
  })
  it('파일 선택 취소는 성공·실패 알림 없이 보호를 해제한다', () => {
    const store = new TaskNotificationStore()
    const task = store.begin('내보내기')
    task.cancel()
    task.finish('success', '완료')
    expect(store.snapshot()).toEqual([])
    expect(store.isRunning()).toBe(false)
  })
  it('종료된 작업의 중복 응답은 처음 결과를 덮어쓰지 않는다', () => {
    const store = new TaskNotificationStore()
    const task = store.begin('조회')
    task.finish('warning', '일부 실패')
    task.finish('success', '전체 완료')
    task.cancel()
    expect(store.snapshot()[0].status).toBe('warning')
  })
  it('완료는 8초 뒤 숨기고 실패·일부 실패는 확인할 때까지 남긴다', () => {
    let now = 0
    const store = new TaskNotificationStore(() => now)
    store.begin('완료').finish('success', '완료')
    store.begin('실패').finish('error', '실패')
    store.begin('일부 실패').finish('warning', '확인 필요')
    now = 7999
    store.expire()
    expect(store.snapshot()).toHaveLength(3)
    now = 8000
    store.expire()
    expect(store.snapshot().map((row) => row.status)).toEqual(['error', 'warning'])
    store.dismiss(store.snapshot()[0].id)
    expect(store.snapshot()).toHaveLength(1)
  })
  it('종료된 알림은 최근 3개만 남겨도 실행 중인 작업은 제거하지 않는다', () => {
    const store = new TaskNotificationStore()
    const pending = store.begin('처리 중')
    for (let i = 0; i < 10; i++) store.begin(`작업 ${i}`).finish('error', '실패')
    expect(store.snapshot().map((row) => row.title)).toEqual([
      '처리 중',
      '작업 7',
      '작업 8',
      '작업 9'
    ])
    pending.finish('success', '완료')
    expect(store.isRunning()).toBe(false)
    expect(store.snapshot()).toHaveLength(3)
    expect(store.snapshot().at(-1)?.title).toBe('처리 중')
  })
  it('화면 구독을 해제해도 작업 상태는 유지하고 안정적인 스냅샷을 제공한다', () => {
    const store = new TaskNotificationStore()
    let updates = 0
    const unsubscribe = store.subscribe(() => updates++)
    const task = store.begin('조회')
    expect(store.snapshot()).toBe(store.snapshot())
    unsubscribe()
    task.finish('success', '완료')
    expect(updates).toBe(1)
    expect(store.snapshot()[0].status).toBe('success')
  })
  it('일괄 조회의 전체 실패·일부 성공·전체 성공을 구분한다', () => {
    expect(batchTaskStatus(0, 2)).toBe('error')
    expect(batchTaskStatus(3, 2)).toBe('warning')
    expect(batchTaskStatus(3, 0)).toBe('success')
    expect(batchTaskStatus(0, 0)).toBe('success')
  })
})
