import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeeklyOverview, WeeklyCharacter } from '../../../shared/contracts/weekly.contract'
import { guildContent } from '../../../shared/weekly-content'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { formatMeso } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { QueryFailure } from '../../components/ui/QueryFailure'
import { useTaskNotifications } from '../../components/TaskNotifications'
import { batchTaskStatus } from '../../../shared/task-notifications'
import { useViewState } from '../../components/ViewState'
import { useDataRevision, useStartupSyncRunning } from '../../lib/data-sync-state'

function GuildStatus({ row, kind }: { row: WeeklyCharacter; kind: 'suro' | 'flag' }) {
  if (row.error) return <span className="font-semibold text-expense">확인 불가</span>
  if (!row.contents)
    return (
      <span className="text-muted">
        {row.error ? '확인 불가' : row.connected ? '미조회' : 'API 연결 필요'}
      </span>
    )
  const content = guildContent(row.contents, kind)
  if (!content)
    return kind === 'suro' ? (
      <span className="font-semibold text-expense">X · 참여 기록 없음</span>
    ) : (
      <span className="text-muted">확인 불가</span>
    )
  return content.count > 0 ? (
    <span className="font-semibold text-brand">O · {formatMeso(content.count)}점</span>
  ) : (
    <span className={kind === 'suro' ? 'font-semibold text-expense' : 'text-muted'}>
      {kind === 'suro' ? 'X · 참여 기록 없음' : '참여 기록 없음 · 0점'}
    </span>
  )
}

export function WeeklyPage() {
  const revision = useDataRevision()
  const startupRunning = useStartupSyncRunning()
  const tasks = useTaskNotifications()
  const [data, setData] = useState<WeeklyOverview>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [showPrevious, setShowPrevious] = useViewState('weeklyPrevious', () => false)
  const alive = useRef(false),
    pending = useRef(false)
  const failed = useRef(false)
  const refreshQueued = useRef(false)
  const lastSync = useRef(false)
  const load = useCallback(
    async (sync: boolean): Promise<void> => {
      if (pending.current) {
        if (!sync) refreshQueued.current = true
        return
      }
      pending.current = true
      lastSync.current = sync
      setBusy(true)
      setError('')
      const task = sync ? tasks.begin('주간 콘텐츠 API 확인') : undefined
      try {
        const overview = await unwrap(sync ? getBridge().weekly.sync() : getBridge().weekly.list())
        const connected = overview.characters.filter((row) => row.connected)
        const incomplete = connected.filter((row) => row.error || !row.fetchedAt).length
        const succeeded = connected.length - incomplete
        task?.finish(
          batchTaskStatus(succeeded, incomplete),
          `확인 ${succeeded}명 · 실패·미처리 ${incomplete}명. 캐릭터별 참여 현황을 확인해 주세요.`
        )
        if (alive.current) {
          failed.current = false
          setData(overview)
        }
      } catch (caught) {
        task?.finish('error', '주간 콘텐츠를 확인하지 못했습니다. 다시 시도해 주세요.')
        if (alive.current) {
          failed.current = true
          setData(undefined)
          setError(caught instanceof Error ? caught.message : '주간 콘텐츠를 조회하지 못했습니다.')
        }
      } finally {
        pending.current = false
        if (alive.current) setBusy(false)
        if (refreshQueued.current && alive.current) {
          refreshQueued.current = false
          void load(false)
        }
      }
    },
    [tasks]
  )
  useEffect(() => {
    alive.current = true
    void load(false)
    // Read cached state to notice Thursday's reset while this screen stays open.
    const timer = setInterval(() => {
      if (!failed.current) void load(false)
    }, 60000)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [load, revision])
  const selected = showPrevious ? data?.previous : data
  const rows = (selected?.characters ?? []).filter(
    (row) => !showPrevious || row.fetchedAt || row.contents !== undefined
  )
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">{showPrevious ? '지난주' : '이번 주'} 콘텐츠</h2>
            <p className="mt-2 text-xs text-muted">
              {selected
                ? `${selected.week} (목) ~ ${selected.end} (수)`
                : busy
                  ? '주차 확인 중…'
                  : '주차 확인 불가'}{' '}
              · 한국 시간 목요일 00시 초기화
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <select
              aria-label="주간 콘텐츠 주차"
              value={showPrevious ? 'previous' : 'current'}
              disabled={busy}
              onChange={(event) => setShowPrevious(event.target.value === 'previous')}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs"
            >
              <option value="current">이번 주</option>
              <option value="previous">지난주</option>
            </select>
            <Button
              disabled={
                busy ||
                startupRunning ||
                showPrevious ||
                !data?.characters.some((row) => row.connected)
              }
              onClick={() => void load(true)}
            >
              {busy ? '조회 중…' : '전체 새로고침'}
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs leading-6 text-muted">
          앱 실행 시 한 번 자동 확인하며, 전체 새로고침으로 다시 확인할 수 있습니다.
          지하수로·플래그는 이번 주 참여 기록과 점수를 표시합니다.
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted">
          조회 결과는 재실행 후에도 유지됩니다. 이번 주와 지난주만 보관하며, 2주 전 기록은 자동
          삭제합니다.
          {showPrevious
            ? ' 지난주는 저장된 기록만 표시합니다.'
            : ' 최신 점수는 전체 새로고침으로 확인하세요.'}
        </p>
      </section>
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-6 py-5 text-sm font-semibold">
          캐릭터별 주간 수행 현황
        </h2>
        {!busy && !data ? (
          <QueryFailure
            label="주간 콘텐츠"
            message={error}
            onRetry={() => void load(lastSync.current)}
          />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-canvas text-muted">
                <tr>
                  {['서버 · 캐릭터', '지하수로', '플래그 레이스', '마지막 확인'].map((title) => (
                    <th key={title} scope="col" className="px-5 py-4">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  return (
                    <tr key={row.characterId} className="border-t border-line align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{row.name}</p>
                        <p className="mt-1 text-muted">{row.world}</p>
                      </td>
                      <td className="px-5 py-4">
                        <GuildStatus row={row} kind="suro" />
                      </td>
                      <td className="px-5 py-4">
                        <GuildStatus row={row} kind="flag" />
                      </td>
                      <td className="max-w-64 px-5 py-4 text-[11px] leading-5 text-muted">
                        {row.fetchedAt
                          ? new Date(row.fetchedAt).toLocaleString('ko-KR', {
                              timeZone: 'Asia/Seoul'
                            })
                          : '—'}
                        {row.error && <p className="mt-1 break-words text-expense">{row.error}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : busy ? (
          <p role="status" className="p-6 text-xs text-muted">
            캐릭터 목록을 확인하는 중…
          </p>
        ) : (
          <EmptyState
            icon="weekly"
            title={showPrevious ? '지난주 저장된 기록이 없어요' : '표시할 캐릭터가 없어요'}
            description={
              showPrevious
                ? '지난주는 저장된 참여 기록만 확인할 수 있습니다.'
                : '캐릭터 관리에서 캐릭터를 등록해 주세요.'
            }
          />
        )}
      </section>
    </div>
  )
}
