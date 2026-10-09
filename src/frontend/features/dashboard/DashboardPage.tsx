import type { PageId } from '../../app/navigation'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon, type IconName } from '../../components/ui/Icon'
import { useState } from 'react'
import { FinancialSummary } from '../../components/FinancialSummary'
import { Button } from '../../components/ui/Button'
import { formatMeso, thisMonthQuery, ledgerLabel } from '../../lib/format'
import { useDashboard } from './useDashboard'
import { DashboardBreakdown } from './DashboardBreakdown'
import { RecordFilters } from '../../components/RecordFilters'
import { useCharacters } from '../characters/useCharacters'
import { CharacterAvatar } from '../../components/CharacterAvatar'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import { getKstDate } from '../../../shared/dates'

const shortcuts: { page: PageId; icon: IconName; title: string; detail: string }[] = [
  {
    page: 'characters',
    icon: 'characters',
    title: '캐릭터 관리',
    detail: '기록할 캐릭터를 모아보세요'
  },
  { page: 'bosses', icon: 'boss', title: '보스 장부', detail: '주간 클리어와 결정석 수익' },
  { page: 'hunting', icon: 'hunting', title: '사냥 장부', detail: '오늘의 사냥을 한 회차씩' }
]

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [query, setQuery] = useState(thisMonthQuery)
  const state = useDashboard(query)
  const characters = useCharacters()
  function quickPeriod(period: 'week' | 'lastWeek' | 'month' | 'lastMonth') {
    const today = getKstDate(),
      week = bossWeek(today)
    const previous = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
    previous.setUTCDate(0)
    const last = previous.toISOString().slice(0, 10)
    const dates =
      period === 'week'
        ? { from: week, to: today }
        : period === 'lastWeek'
          ? { from: shiftDate(week, -7), to: shiftDate(week, -1) }
          : period === 'month'
            ? thisMonthQuery()
            : { from: last.slice(0, 7) + '-01', to: last }
    setQuery({ ...dates, ...(query.characterId ? { characterId: query.characterId } : {}) })
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(['week', 'lastWeek', 'month', 'lastMonth'] as const).map((period, index) => (
          <Button
            key={period}
            variant="secondary"
            disabled={state.loading}
            onClick={() => quickPeriod(period)}
          >
            {['이번 주', '지난주', '이번 달', '지난달'][index]}
          </Button>
        ))}
        <Button
          variant="secondary"
          disabled={state.loading || characters.loading}
          onClick={() => {
            state.reload()
            void characters.reload()
          }}
        >
          새로고침
        </Button>
      </div>
      <RecordFilters
        key={`filters:${query.from}:${query.to}:${query.characterId ?? ''}`}
        initial={query}
        characters={characters.characters}
        busy={state.loading || characters.loading}
        onApply={setQuery}
        showMonthShortcut={false}
      />
      {characters.error && (
        <p role="alert" className="text-xs text-expense">
          {characters.error}
        </p>
      )}
      {state.error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-expense/20 p-4 text-xs text-expense"
        >
          <span>{state.error}</span>
          <Button variant="secondary" disabled={state.loading} onClick={state.reload}>
            다시 시도
          </Button>
        </div>
      )}
      <section className="flex items-center justify-between gap-6 rounded-2xl border border-brand/10 bg-brand-soft px-6 py-5">
        <div>
          <p className="text-sm font-semibold text-brand">기간별 장부 수익을 확인하세요</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            사냥·결정석·드랍 거래를 수익·지출 반영일 기준으로 집계합니다. 주간 조회는 목요일
            00시(KST) 기준이며 숨긴 캐릭터의 기록도 포함합니다. 결정석은 실제 처치일이 아닌 장부
            반영일 기준입니다. API로 새로 확인한 수익은 이번 주에는 조회일, 과거 주에는 주차
            시작일로 기록하며 보스 장부에서 수정할 수 있습니다.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-white/70 px-3 py-2 text-xs text-brand">
          보스·사냥 장부 사용 가능
        </span>
      </section>
      <FinancialSummary summary={state.data?.summary} loading={state.loading} prefix="조회 기간" />
      {state.data && (
        <DashboardBreakdown
          key={`breakdown:${query.from}:${query.to}:${query.characterId ?? ''}`}
          data={state.data}
          characters={characters.characters}
          onCharacter={(id) => setQuery({ ...query, characterId: id })}
        />
      )}
      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <h2 className="text-sm font-semibold">최근 거래</h2>
            <span className="text-[11px] text-muted">
              {query.from} ~ {query.to}
            </span>
          </div>
          {state.loading ? (
            <p role="status" className="p-10 text-center text-sm text-muted">
              수익을 불러오는 중…
            </p>
          ) : state.data?.recent.length ? (
            <div className="divide-y divide-line px-6">
              {state.data.recent.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 py-5">
                  <div className="flex items-center gap-3">
                    <CharacterAvatar
                      character={characters.characters.find((row) => row.id === entry.characterId)}
                      name={entry.characterName}
                    />
                    <div>
                      <p className="break-all text-xs font-semibold">{entry.characterName}</p>
                      <p className="mt-2 text-[11px] text-muted">
                        {entry.date} · {entry.characterWorld} · {ledgerLabel(entry)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 text-xs font-semibold tabular-nums ${entry.direction === 'income' ? 'text-brand' : 'text-expense'}`}
                  >
                    {entry.direction === 'income' ? '+' : '−'}
                    {formatMeso(entry.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="ledger"
              title="조회 기간에 거래가 없어요"
              description="사냥 기록·보스 클리어·드랍 판매를 저장하면 실제 수입과 지출이 표시됩니다."
            />
          )}
        </section>
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">기록 바로가기</h2>
          <div className="mt-5 space-y-3">
            {shortcuts.map((item) => (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigate(item.page)}
                className="group flex w-full items-center gap-3 rounded-xl border border-line p-4 text-left transition hover:border-brand/30 hover:bg-brand-soft"
              >
                <span className="rounded-lg bg-canvas p-2 text-brand">
                  <Icon name={item.icon} />
                </span>
                <div>
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="mt-1 text-[11px] text-muted">{item.detail}</p>
                </div>
                <Icon name="arrow" className="ml-auto size-4 text-muted group-hover:text-brand" />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="rounded-xl border border-dashed border-line px-5 py-4 text-xs leading-5 text-muted">
        <span className="font-semibold text-ink">정산 기준</span>
        <span className="mx-2">·</span>실제 받은 메소와 미판매 아이템의 예상 가치는 따로 기록합니다.
      </div>
    </div>
  )
}
