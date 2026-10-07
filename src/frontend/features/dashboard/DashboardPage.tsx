import type { PageId } from '../../app/navigation'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon, type IconName } from '../../components/ui/Icon'
import { useState } from 'react'
import { FinancialSummary } from '../../components/FinancialSummary'
import { Button } from '../../components/ui/Button'
import { formatMeso, thisMonthQuery } from '../../lib/format'
import { useLedger } from '../ledger/useLedger'

const shortcuts: { page: PageId; icon: IconName; title: string; detail: string }[] = [
  {
    page: 'characters',
    icon: 'characters',
    title: '캐릭터 관리',
    detail: '기록할 캐릭터를 모아보세요'
  },
  { page: 'bosses', icon: 'boss', title: '보스 장부', detail: '클리어부터 판매 정산까지' },
  { page: 'hunting', icon: 'hunting', title: '사냥 장부', detail: '오늘의 사냥을 한 회차씩' }
]

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [query] = useState(thisMonthQuery)
  const state = useLedger(query)
  return (
    <div className="space-y-6">
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
          <p className="text-sm font-semibold text-brand">나의 기록장을 시작해 볼까요?</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            캐릭터를 등록한 뒤 사냥 장부에 첫 회차를 기록해 보세요. 수입과 지출이 자동으로 모입니다.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-white/70 px-3 py-2 text-xs text-brand">
          사냥 장부 사용 가능
        </span>
      </section>
      <FinancialSummary summary={state.data?.summary} loading={state.loading} prefix="이번 달" />
      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <h2 className="text-sm font-semibold">최근 사냥 거래</h2>
            <span className="text-[11px] text-muted">
              {query.from} ~ {query.to}
            </span>
          </div>
          {state.loading ? (
            <p role="status" className="p-10 text-center text-sm text-muted">
              수익을 불러오는 중…
            </p>
          ) : state.data?.entries.length ? (
            <div className="divide-y divide-line px-6">
              {state.data.entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="break-all text-xs font-semibold">{entry.characterName}</p>
                    <p className="mt-2 text-[11px] text-muted">
                      {entry.date} · {entry.direction === 'income' ? '사냥 획득' : '사냥 소모 비용'}
                    </p>
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
              title="아직 이번 달 거래가 없어요"
              description="사냥 장부에 획득 메소와 비용을 기록하면 이곳에 실제 수입과 지출이 표시됩니다."
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
