import { useState } from 'react'
import type { HuntingSession } from '../../../shared/contracts/hunting.contract'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { FinancialSummary } from '../../components/FinancialSummary'
import { RecordFilters } from '../../components/RecordFilters'
import { formatMeso, formatMinutes, thisMonthQuery } from '../../lib/format'
import { HuntingSessionForm } from './HuntingSessionForm'
import { HuntingSessionList } from './HuntingSessionList'
import { useHunting } from './useHunting'

export function HuntingPage() {
  const [query, setQuery] = useState(thisMonthQuery)
  const state = useHunting(query)
  const [editing, setEditing] = useState<HuntingSession | null>(null)
  const [deleting, setDeleting] = useState<HuntingSession | null>(null)
  const summary = state.data?.summary
  return (
    <div className="space-y-5">
      {state.notice && (
        <p
          role="status"
          className="rounded-xl border border-brand/15 bg-brand-soft px-5 py-3 text-xs leading-5 text-brand"
        >
          {state.notice}
        </p>
      )}
      {state.error && !editing && !deleting && (
        <p
          role="alert"
          className="rounded-xl border border-expense/20 bg-expense/5 px-5 py-3 text-xs text-expense"
        >
          {state.error}
        </p>
      )}
      <RecordFilters
        initial={query}
        characters={state.characters}
        busy={state.loading || state.busy}
        onApply={setQuery}
      />
      <FinancialSummary summary={summary} loading={state.loading} />
      <div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">사냥 회차 추가</h2>
          <p className="mb-5 mt-2 text-xs leading-5 text-muted">
            획득 메소와 소모 비용은 거래 내역에 자동 반영됩니다.
          </p>
          {!state.loading && state.characters.every((character) => character.isHidden) && (
            <p className="mb-4 rounded-lg bg-brand-soft p-3 text-xs leading-5 text-brand">
              캐릭터 관리에서 캐릭터를 등록하거나 숨김을 해제해 주세요.
            </p>
          )}
          <HuntingSessionForm
            characters={state.characters}
            busy={state.busy || state.loading}
            onSave={state.create}
          />
        </section>
        <section
          aria-busy={state.loading}
          className="min-w-0 rounded-2xl border border-line bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5">
            <div>
              <h2 className="text-sm font-semibold">
                사냥 회차 <span className="ml-1 text-brand">{summary?.count ?? 0}</span>
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                총 {summary ? formatMinutes(summary.minutes) : '—'} · 시간당 순수익{' '}
                {summary?.hourlyNet != null
                  ? `${formatMeso(summary.hourlyNet)} 메소`
                  : '시간 기록 없음'}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={state.loading || state.busy}
              onClick={() => void state.reload()}
            >
              새로고침
            </Button>
          </div>
          {state.loading ? (
            <p role="status" className="p-10 text-center text-sm text-muted">
              사냥 기록을 불러오는 중…
            </p>
          ) : state.data?.sessions.length ? (
            <HuntingSessionList
              sessions={state.data.sessions}
              busy={state.busy}
              onEdit={(session) => {
                state.clearFeedback()
                setEditing(session)
              }}
              onRemove={(session) => {
                state.clearFeedback()
                setDeleting(session)
              }}
            />
          ) : (
            <EmptyState
              icon="hunting"
              title="조회 기간에 사냥 기록이 없어요"
              description="캐릭터를 선택해 첫 회차를 기록하거나 다른 기간을 조회해 보세요."
            />
          )}
        </section>
      </div>
      {editing && (
        <Dialog title="사냥 기록 수정" busy={state.busy} onClose={() => setEditing(null)}>
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <HuntingSessionForm
            key={editing.id}
            characters={state.characters}
            initial={editing}
            busy={state.busy}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              const saved = await state.update(editing.id, input)
              if (saved) setEditing(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {deleting && (
        <Dialog title="사냥 기록 삭제" busy={state.busy} onClose={() => setDeleting(null)}>
          <p className="text-sm leading-6">
            {deleting.date}의 {deleting.characterName} 사냥 기록을 삭제할까요?
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            연결된 수입·지출도 함께 삭제됩니다. 삭제 후에는 복구할 수 없습니다.
          </p>
          {state.error && (
            <p role="alert" className="mt-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" disabled={state.busy} onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={state.busy}
              onClick={() => {
                void state.remove(deleting.id).then((removed) => {
                  if (removed) setDeleting(null)
                })
              }}
            >
              {state.busy ? '삭제 중…' : '삭제 확인'}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
