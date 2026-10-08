import { useState } from 'react'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import {
  currentBossWeek,
  parseBossQuery,
  type BossRun
} from '../../../shared/contracts/boss.contract'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatMeso } from '../../lib/format'
import { BossRosterManager } from './BossRosterManager'
import { BossRunForm } from './BossRunForm'
import { bossesApi } from './bosses.api'
import { useBosses } from './useBosses'
import { DropManager } from '../drops/DropManager'

type Confirmation = {
  title: string
  description: string
  action: () => Promise<unknown>
  message: string
}
export function BossesPage() {
  const [query, setQuery] = useState<{ date: string; characterId?: string }>(() => ({
    date: currentBossWeek()
  }))
  const state = useBosses(query)
  const [periodError, setPeriodError] = useState('')
  const [editingRun, setEditingRun] = useState<BossRun | null>(null)
  const [drops, setDrops] = useState<BossRun | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const disabled = state.loading || state.busy
  const week = bossWeek(query.date)
  const summary = state.data?.summary
  const modal = Boolean(editingRun || confirmation)
  function confirm(value: Confirmation) {
    state.clearFeedback()
    setConfirmation(value)
  }
  return (
    <div className="space-y-5">
      {state.notice && (
        <p role="status" className="rounded-xl bg-brand-soft p-4 text-xs text-brand">
          {state.notice}
        </p>
      )}
      {state.error && !modal && (
        <p role="alert" className="rounded-xl bg-expense/5 p-4 text-xs text-expense">
          {state.error}
        </p>
      )}
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-5">
        <label className="text-xs text-muted">
          보스 주차 기준일
          <input
            aria-label="보스 주차 기준일"
            type="date"
            min="2000-01-06"
            value={query.date}
            disabled={disabled}
            onChange={(event) => {
              if (!event.target.value) return
              try {
                setQuery(parseBossQuery({ ...query, date: event.target.value }))
                setPeriodError('')
              } catch (caught) {
                setPeriodError(
                  caught instanceof Error ? caught.message : '조회 날짜를 확인해 주세요.'
                )
              }
            }}
            className="mt-2 block rounded-lg border border-line px-3 py-2"
          />
        </label>
        <label className="text-xs text-muted">
          보스 조회 캐릭터
          <select
            aria-label="보스 조회 캐릭터"
            value={query.characterId ?? ''}
            disabled={disabled}
            onChange={(event) =>
              setQuery({ ...query, characterId: event.target.value || undefined })
            }
            className="mt-2 block rounded-lg border border-line px-3 py-2"
          >
            <option value="">전체 캐릭터</option>
            {state.characters.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.world}
                {row.isHidden ? ' (숨김)' : ''}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={disabled || week <= '2000-01-06'}
          onClick={() => setQuery({ ...query, date: shiftDate(week, -7) })}
        >
          이전 주
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || week >= currentBossWeek()}
          onClick={() => setQuery({ ...query, date: shiftDate(week, 7) })}
        >
          다음 주
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => setQuery({ ...query, date: currentBossWeek() })}
        >
          이번 주
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => void state.reload()}>
          새로고침
        </Button>
        <p className="basis-full text-[11px] leading-5 text-muted">
          {week} ~ {shiftDate(week, 6)} · 목요일 0시(KST) 기준 · 주간 보스를 직접 등록해 기록합니다.
        </p>
      </section>
      {periodError && (
        <p role="alert" className="text-xs text-expense">
          {periodError}
        </p>
      )}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            title: '클리어 진행',
            value: summary ? `${summary.cleared} / ${summary.count}` : '—',
            detail: '클리어 체크 시 결정석 수익 자동 반영'
          },
          {
            title: '남은 보스 예상 수익',
            value: summary ? `${formatMeso(summary.remaining)} 메소` : '—',
            detail: '주차에 저장된 결정석 가격과 클리어 인원으로 계산'
          },
          {
            title: '이 주차 결정석 수익',
            value: summary ? `${formatMeso(summary.settled)} 메소` : '—',
            detail: '클리어한 보스 기준 · 드랍 수익은 별도 반영'
          }
        ].map((card) => (
          <article
            key={card.title}
            className="min-w-0 rounded-2xl border border-line bg-surface p-5"
          >
            <p className="text-xs text-muted">{card.title}</p>
            <p className="my-4 break-all text-lg font-semibold tabular-nums text-brand">
              {card.value}
            </p>
            <p className="text-[11px] leading-5 text-muted">{card.detail}</p>
          </article>
        ))}
      </div>
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5">
          <div>
            <h2 className="text-sm font-semibold">주간 보스 기록</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              클리어를 체크하면 결정석 수익이 바로 반영됩니다. 체크 해제 시 해당 수입도 취소됩니다.
              드랍 판매는 별도로 기록합니다.
            </p>
          </div>
          <Button
            disabled={disabled || !state.presets.length || week > currentBossWeek()}
            onClick={() =>
              void state.mutate(
                () => bossesApi.generate(query),
                '프리셋으로 주차 기록을 생성했습니다. 기존 기록은 유지했습니다.'
              )
            }
          >
            프리셋으로 주차 생성
          </Button>
        </div>
        {state.loading ? (
          <p role="status" className="p-10 text-center text-xs text-muted">
            보스 기록을 불러오는 중…
          </p>
        ) : state.data?.runs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="border-b border-line bg-canvas text-muted">
                <tr>
                  {['캐릭터 / 보스', '결정석 내 몫', '클리어', '반영 수익', '관리'].map((title) => (
                    <th key={title} scope="col" className="px-5 py-4 font-medium">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.runs.map((run) => (
                  <tr key={run.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-semibold">
                        {run.characterName}{' '}
                        <span className="font-normal text-muted">· {run.characterWorld}</span>
                      </p>
                      <p className="mt-2">
                        {run.bossName} · {run.difficulty}
                      </p>
                      {run.notes && (
                        <p className="mt-2 max-w-48 whitespace-pre-wrap break-words text-muted">
                          {run.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      <p>{formatMeso(run.expectedShare)} 메소</p>
                      <p className="mt-2 text-muted">
                        {run.partySize}인 · 전체 {formatMeso(run.crystalPrice)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`${run.characterName} ${run.bossName} 클리어`}
                          checked={run.isCleared}
                          disabled={disabled}
                          onChange={(event) =>
                            void state.mutate(
                              () => bossesApi.setClear(run.id, event.target.checked),
                              event.target.checked
                                ? '클리어와 결정석 수익을 반영했습니다.'
                                : '클리어와 결정석 수익을 취소했습니다.'
                            )
                          }
                          className="accent-brand"
                        />
                        {run.isCleared ? '완료' : '미완료'}
                      </label>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-brand">
                        {formatMeso(
                          run.isCleared ? (run.settlement?.amount ?? run.expectedShare) : 0
                        )}{' '}
                        메소
                      </p>
                      {run.settlement && (
                        <p className="mt-2 text-muted">반영일 {run.settlement.date}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={disabled || !run.isCleared}
                          onClick={() => setDrops(run)}
                        >
                          드랍 관리
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={disabled}
                          onClick={() => {
                            state.clearFeedback()
                            setEditingRun(run)
                          }}
                        >
                          기록 수정
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={disabled}
                          onClick={() =>
                            confirm({
                              title: '보스 기록 삭제',
                              description: `${run.characterName}의 ${run.bossName} 기록을 이 주차에서 삭제합니다. 결정석 수익도 취소됩니다. 프리셋은 유지됩니다. 다시 주차를 생성하면 이 기록이 추가됩니다.`,
                              action: () => bossesApi.removeRun(run.id),
                              message: '주차 보스 기록을 삭제했습니다.'
                            })
                          }
                        >
                          기록 삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="boss"
            title="이 주차에 보스 기록이 없어요"
            description="아래에서 프리셋을 추가하고 프리셋으로 주차 생성을 눌러 주세요. 과거 주차의 기록도 그대로 보존됩니다."
          />
        )}
      </section>
      <BossRosterManager
        state={state.rosterState}
        characters={state.characters}
        characterId={query.characterId}
        busy={disabled}
        error={state.error}
        mutate={state.mutate}
      />
      {drops && (
        <DropManager
          source={{ kind: 'boss', id: drops.id }}
          title={`${drops.characterName} · ${drops.bossName}`}
          onClose={() => setDrops(null)}
          onChanged={state.reload}
        />
      )}
      {editingRun && (
        <Dialog title="주차 보스 기록 수정" busy={state.busy} onClose={() => setEditingRun(null)}>
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <BossRunForm
            run={editingRun}
            busy={state.busy}
            onCancel={() => setEditingRun(null)}
            onSave={async (input) => {
              const saved = await state.mutate(
                () => bossesApi.updateRun(input),
                '이 주차의 보스 기록을 수정했습니다.'
              )
              if (saved) setEditingRun(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {confirmation && (
        <Dialog title={confirmation.title} busy={state.busy} onClose={() => setConfirmation(null)}>
          <p className="text-sm leading-6">{confirmation.description}</p>
          {state.error && (
            <p role="alert" className="mt-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" disabled={state.busy} onClick={() => setConfirmation(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={state.busy}
              onClick={() =>
                void state.mutate(confirmation.action, confirmation.message).then((saved) => {
                  if (saved) setConfirmation(null)
                })
              }
            >
              확인
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
