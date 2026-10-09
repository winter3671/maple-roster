import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeeklyOverview, WeeklyCharacter } from '../../../shared/contracts/weekly.contract'
import { guildContent } from '../../../shared/weekly-content'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { formatMeso } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

function GuildStatus({ row, kind }: { row: WeeklyCharacter; kind: 'suro' | 'flag' }) {
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
  const [data, setData] = useState<WeeklyOverview>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const alive = useRef(false),
    pending = useRef(false)
  const load = useCallback(async (sync: boolean) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const overview = await unwrap(sync ? getBridge().weekly.sync() : getBridge().weekly.list())
      if (alive.current) setData(overview)
    } catch (caught) {
      if (alive.current)
        setError(caught instanceof Error ? caught.message : '주간 콘텐츠를 조회하지 못했습니다.')
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }, [])
  useEffect(() => {
    alive.current = true
    void load(false)
    // Read cached state to notice Thursday's reset while this screen stays open.
    const timer = setInterval(() => void load(false), 60000)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [load])
  const rows = data?.characters.filter((row) => showHidden || !row.isHidden) ?? []
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">이번 주 콘텐츠</h2>
            <p className="mt-2 text-xs text-muted">
              {data ? `${data.week} (목) ~ ${data.end} (수)` : '주차 확인 중…'} · 한국 시간 목요일
              00시 초기화
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(event) => setShowHidden(event.target.checked)}
              />
              숨김 포함
            </label>
            <Button
              disabled={busy || !data?.characters.some((row) => row.connected)}
              onClick={() => void load(true)}
            >
              {busy ? '조회 중…' : '전체 새로고침'}
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs leading-6 text-muted">
          전체 새로고침으로 등록된 API 캐릭터를 일괄 확인합니다. 지하수로·플래그는 이번 주 참여
          기록과 점수를 표시합니다.
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted">앱을 재실행하면 다시 조회해 주세요.</p>
        {error && (
          <p role="alert" className="mt-3 text-xs text-expense">
            {error}
          </p>
        )}
      </section>
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-6 py-5 text-sm font-semibold">
          캐릭터별 주간 수행 현황
        </h2>
        {rows.length ? (
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
                        <p className="font-semibold">
                          {row.name}
                          {row.isHidden ? ' (숨김)' : ''}
                        </p>
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
            title="표시할 캐릭터가 없어요"
            description="캐릭터 관리에서 캐릭터를 등록하거나 숨김 포함을 선택해 주세요."
          />
        )}
      </section>
    </div>
  )
}
