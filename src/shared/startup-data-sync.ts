import type { AppApi } from './contracts/app-api'
import { getKstDate } from './dates'
import { batchTaskStatus, type TaskNotificationStore } from './task-notifications'
import { AppError, type ApiResult } from './errors'

async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
  const result = await request
  if (!result.ok) throw new AppError(result.error.code, result.error.message)
  return result.data
}

// One promise per mounted app session, including StrictMode effect replay.
export function createStartupDataSync(
  api: Pick<AppApi, 'nexon' | 'characters' | 'bosses' | 'weekly'>,
  tasks: Pick<TaskNotificationStore, 'begin'>,
  changed: () => void,
  setRunning: (value: boolean) => void,
  now = () => new Date()
): () => Promise<void> {
  let initial: Promise<void> | undefined
  async function run() {
    try {
      const [status, characters] = await Promise.all([
        unwrap(api.nexon.status()),
        unwrap(api.characters.list())
      ])
      if (!status.configured || !characters.some((character) => character.nexon)) return
      setRunning(true)
      const task = tasks.begin('실행 시 API 자동 확인', { background: true })
      let succeeded = 0,
        failed = 0,
        added = 0
      const messages: string[] = []
      try {
        // Keep requests sequential; a failure in one area must not skip the other.
        const today = getKstDate(now())
        try {
          const periods = await unwrap(
            api.bosses.syncPeriods({
              periods: [
                { date: today, cycle: 'weekly' },
                { date: today, cycle: 'monthly' }
              ]
            })
          )
          for (const cycle of ['weekly', 'monthly'] as const) {
            const period = periods.find((period) => period.cycle === cycle)
            const label = cycle === 'weekly' ? '주간 보스' : '월간 보스'
            if (!period?.result || period.error) {
              failed++
              messages.push(
                `${label}: ${period?.error?.message ?? '조회 결과를 확인하지 못했습니다.'}`
              )
              continue
            }
            const items = period.result.items
            const done = items.filter((item) => item.status === 'synced').length
            const errors = items.filter(
              (item) => item.status === 'failed' || item.status === 'notAttempted'
            ).length
            succeeded += done
            failed += errors
            added += items.reduce((sum, item) => sum + (item.added ?? 0), 0)
            messages.push(`${label} 확인 ${done}명 · 실패·미처리 ${errors}명`)
          }
        } catch {
          failed++
          messages.push('보스 기록 확인 실패. 보스 장부에서 다시 확인해 주세요.')
        } finally {
          changed()
        }
        try {
          const overview = await unwrap(api.weekly.sync())
          const connected = overview.characters.filter((row) => row.connected)
          const errors = connected.filter((row) => row.error || !row.fetchedAt).length
          succeeded += connected.length - errors
          failed += errors
          messages.push(`주간 콘텐츠 확인 ${connected.length - errors}명 · 실패·미처리 ${errors}명`)
        } catch {
          failed++
          messages.push('주간 콘텐츠 확인 실패. 전체 새로고침으로 다시 확인해 주세요.')
        } finally {
          changed()
        }
        if (added)
          messages.push(
            'API로 새로 추가한 보스는 1인 기준입니다. 파티로 클리어했다면 인원을 수정해 주세요.'
          )
        task.finish(
          added && !failed ? 'warning' : batchTaskStatus(succeeded, failed),
          messages.join('\n')
        )
      } finally {
        setRunning(false)
      }
    } catch {
      tasks
        .begin('실행 시 API 자동 확인')
        .finish(
          'error',
          '자동 확인을 시작하지 못했습니다. API 설정을 확인한 뒤 각 화면에서 수동으로 새로고침해 주세요.'
        )
    }
  }
  return () => (initial ??= run())
}
