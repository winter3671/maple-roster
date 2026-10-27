import { describe, expect, it, vi } from 'vitest'
import { createStartupDataSync } from '../../shared/startup-data-sync'
import type { AppApi } from '../../shared/contracts/app-api'
import { TaskNotificationStore } from '../../shared/task-notifications'

const ok = (data: unknown) => Promise.resolve({ ok: true, data })
function fixture() {
  const calls: string[] = []
  const api = {
    nexon: { status: vi.fn(() => ok({ configured: true })) },
    characters: { list: vi.fn(() => ok([{ id: 'test', nexon: { ocid: 'fake' } }])) },
    bosses: {
      syncPeriods: vi.fn(() => {
        calls.push('bosses')
        return ok(
          ['weekly', 'monthly'].map((cycle) => ({
            cycle,
            result: { items: [{ status: 'synced', added: 0 }] }
          }))
        )
      })
    },
    weekly: {
      sync: vi.fn(() => {
        calls.push('weekly')
        return ok({ characters: [{ connected: true, fetchedAt: '2026-10-15T00:00:00Z' }] })
      })
    }
  }
  const tasks = new TaskNotificationStore()
  const changed = vi.fn(),
    running = vi.fn()
  const run = createStartupDataSync(
    api as unknown as AppApi,
    tasks,
    changed,
    running,
    () => new Date('2026-10-14T15:00:00Z')
  )
  return { api, tasks, changed, running, run, calls }
}
describe('앱 시작 시 API 일괄 확인', () => {
  it('StrictMode 재실행·동시 호출·메뉴 이동에도 한 번만 순서대로 확인한다', async () => {
    const f = fixture()
    const first = f.run()
    expect(f.run()).toBe(first)
    await first
    await f.run()
    expect(f.api.nexon.status).toHaveBeenCalledTimes(1)
    expect(f.api.bosses.syncPeriods).toHaveBeenCalledExactlyOnceWith({
      periods: [
        { date: '2026-10-15', cycle: 'weekly' },
        { date: '2026-10-15', cycle: 'monthly' }
      ]
    })
    expect(f.calls).toEqual(['bosses', 'weekly'])
    expect(f.changed).toHaveBeenCalledTimes(2)
    expect(f.running.mock.calls).toEqual([[true], [false]])
    expect(f.tasks.snapshot()).toMatchObject([{ status: 'success' }])
  })
  it('API 키나 연결 캐릭터가 없으면 조회 요청과 알림을 만들지 않는다', async () => {
    for (const keyMissing of [true, false]) {
      const f = fixture()
      if (keyMissing) f.api.nexon.status.mockImplementation(() => ok({ configured: false }))
      else f.api.characters.list.mockImplementation(() => ok([{ id: 'manual' }]))
      await f.run()
      expect(f.calls).toEqual([])
      expect(f.tasks.snapshot()).toEqual([])
      expect(f.running).not.toHaveBeenCalled()
    }
  })
  it('보스 조회가 실패해도 주간 콘텐츠를 확인하고 부분 실패를 알린다', async () => {
    const f = fixture()
    f.api.bosses.syncPeriods.mockRejectedValue(new Error('offline'))
    await f.run()
    expect(f.api.weekly.sync).toHaveBeenCalledTimes(1)
    expect(f.tasks.snapshot()[0]).toMatchObject({ status: 'warning' })
    expect(f.tasks.snapshot()[0].message).toContain('보스 기록 확인 실패')
    expect(f.running).toHaveBeenLastCalledWith(false)
  })
  it('캐릭터별 실패·누락된 주기와 주간 콘텐츠 캐시 오류를 성공으로 표시하지 않는다', async () => {
    const f = fixture()
    f.api.bosses.syncPeriods.mockImplementation(() =>
      ok([{ cycle: 'weekly', result: { items: [{ status: 'failed' }] } }])
    )
    f.api.weekly.sync.mockImplementation(() =>
      ok({ characters: [{ connected: true, fetchedAt: 'old', error: '조회 실패' }] })
    )
    await f.run()
    expect(f.tasks.snapshot()[0]).toMatchObject({ status: 'error' })
    expect(f.tasks.snapshot()[0].message).toContain('월간 보스: 조회 결과')
    expect(f.changed).toHaveBeenCalledTimes(2)
  })
  it('신규 보스는 1인 기준 안내를 남기고 주간 조회 실패도 종료 상태를 복구한다', async () => {
    const f = fixture()
    f.api.bosses.syncPeriods.mockImplementation(() =>
      ok(
        ['weekly', 'monthly'].map((cycle) => ({
          cycle,
          result: { items: [{ status: 'synced', added: 1 }] }
        }))
      )
    )
    f.api.weekly.sync.mockRejectedValue(new Error('offline'))
    await f.run()
    expect(f.tasks.snapshot()[0].message).toContain('1인 기준')
    expect(f.tasks.snapshot()[0].message).toContain('주간 콘텐츠 확인 실패')
    expect(f.running).toHaveBeenLastCalledWith(false)
  })
  it('시작 전 상태 확인 실패를 알리고 무한 재시도하지 않는다', async () => {
    const f = fixture()
    f.api.nexon.status.mockRejectedValue(new Error('IPC failure'))
    await f.run()
    await f.run()
    expect(f.api.nexon.status).toHaveBeenCalledTimes(1)
    expect(f.tasks.snapshot()).toMatchObject([{ status: 'error' }])
  })
})
