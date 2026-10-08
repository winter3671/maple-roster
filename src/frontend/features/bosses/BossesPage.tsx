import { useState } from 'react'
import { bossWeek, shiftDate } from '../../../shared/boss-period'
import {
  currentBossWeek,
  parseBossQuery,
  type BossPreset,
  type BossRun
} from '../../../shared/contracts/boss.contract'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatMeso } from '../../lib/format'
import { BossPresetForm } from './BossPresetForm'
import { BossRunForm, CrystalSaleForm } from './BossRunForm'
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
  const [editingPreset, setEditingPreset] = useState<BossPreset | null>(null)
  const [editingRun, setEditingRun] = useState<BossRun | null>(null)
  const [selling, setSelling] = useState<BossRun | null>(null)
  const [drops, setDrops] = useState<BossRun | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const disabled = state.loading || state.busy
  const week = bossWeek(query.date)
  const summary = state.data?.summary
  const modal = Boolean(editingPreset || editingRun || selling || confirmation)
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
            detail: `판매 확정 ${summary?.sold ?? 0}개`
          },
          {
            title: '클리어 후 미판매 예상',
            value: summary ? `${formatMeso(summary.clearedUnsold)} 메소` : '—',
            detail: '프리셋 가격과 파티 인원으로 계산'
          },
          {
            title: '이 주차 판매 확정',
            value: summary ? `${formatMeso(summary.settled)} 메소` : '—',
            detail: '결정석 수령액 · 드랍 판매는 드랍 관리에서 확인'
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
              클리어 후 결정석·드랍 판매를 기록하면 실제 수입이 반영됩니다. 위 주차 요약은 결정석
              기준입니다.
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
                  {['캐릭터 / 보스', '예상 내 몫', '클리어', '판매 기록', '관리'].map((title) => (
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
                          disabled={disabled || Boolean(run.settlement)}
                          onChange={(event) =>
                            void state.mutate(
                              () => bossesApi.setClear(run.id, event.target.checked),
                              '클리어 상태를 저장했습니다.'
                            )
                          }
                          className="accent-brand"
                        />
                        {run.isCleared ? '완료' : '미완료'}
                      </label>
                    </td>
                    <td className="px-5 py-4">
                      {run.settlement ? (
                        <>
                          <p className="font-semibold text-brand">
                            {formatMeso(run.settlement.amount)} 메소
                          </p>
                          <p className="mt-2 text-muted">판매일 {run.settlement.date}</p>
                        </>
                      ) : (
                        <span className="text-muted">미판매</span>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={disabled || !run.isCleared}
                          onClick={() => {
                            state.clearFeedback()
                            setSelling(run)
                          }}
                        >
                          {run.settlement ? '판매 수정' : '판매 기록'}
                        </Button>
                        {run.settlement && (
                          <Button
                            variant="secondary"
                            disabled={disabled}
                            onClick={() =>
                              confirm({
                                title: '결정석 판매 취소',
                                description: `${run.characterName}의 ${run.bossName} 판매 기록과 연결 수입을 삭제합니다. 클리어 기록은 유지됩니다.`,
                                action: () => bossesApi.cancelSale(run.id),
                                message: '판매 기록과 연결 수입을 취소했습니다.'
                              })
                            }
                          >
                            판매 취소
                          </Button>
                        )}
                      </div>
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
                          disabled={disabled || Boolean(run.settlement)}
                          onClick={() => {
                            state.clearFeedback()
                            setEditingRun(run)
                          }}
                        >
                          기록 수정
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={disabled || Boolean(run.settlement)}
                          onClick={() =>
                            confirm({
                              title: '보스 기록 삭제',
                              description: `${run.characterName}의 ${run.bossName} 기록을 이 주차에서 삭제합니다. 프리셋은 유지됩니다. 다시 주차를 생성하면 이 기록이 추가됩니다.`,
                              action: () => bossesApi.removeRun(run.id),
                              message: '주차 보스 기록을 삭제했습니다.'
                            })
                          }
                        >
                          기록 삭제
                        </Button>
                      </div>
                      {run.settlement && (
                        <p className="mt-2 text-[11px] text-muted">판매 취소 후 기록 수정 가능</p>
                      )}
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
      <details className="rounded-2xl border border-line bg-surface" open>
        <summary className="cursor-pointer px-6 py-5 text-sm font-semibold">
          프리셋 관리 · {state.presets.length}개
        </summary>
        <div className="grid items-start gap-5 border-t border-line p-6 lg:grid-cols-[280px_1fr]">
          <div>
            <h2 className="mb-4 text-sm font-semibold">보스 프리셋 추가</h2>
            <BossPresetForm
              characters={
                query.characterId
                  ? state.characters.filter((row) => row.id === query.characterId)
                  : state.characters
              }
              busy={disabled}
              onSave={(input) =>
                state.mutate(
                  () => bossesApi.createPreset(input),
                  '프리셋을 추가했습니다. 주차 생성을 눌러 이번 기록에 적용하세요.'
                )
              }
            />
          </div>
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted">
              주간 보스 이름을 일관되게 입력하세요. 같은 캐릭터·보스는 난이도별로 중복 추가할 수
              없습니다. 프리셋 수정·삭제는 이미 생성한 주차 기록에 영향을 주지 않습니다.
            </p>
            {state.presets.map((preset) => (
              <article key={preset.id} className="rounded-xl border border-line p-4">
                <p className="text-sm font-semibold">
                  {preset.characterName} · {preset.bossName} ({preset.difficulty})
                </p>
                <p className="mt-2 text-xs text-muted">
                  {preset.partySize}인 · 결정석 전체 {formatMeso(preset.crystalPrice)} 메소
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => {
                      state.clearFeedback()
                      setEditingPreset(preset)
                    }}
                  >
                    프리셋 수정
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={disabled}
                    onClick={() =>
                      confirm({
                        title: '프리셋 삭제',
                        description: `${preset.characterName}의 ${preset.bossName} 프리셋을 삭제합니다. 과거 주차와 판매 기록은 유지됩니다.`,
                        action: () => bossesApi.removePreset(preset.id),
                        message: '프리셋을 삭제했습니다. 주차 기록은 유지했습니다.'
                      })
                    }
                  >
                    프리셋 삭제
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </details>
      {editingPreset && (
        <Dialog title="보스 프리셋 수정" busy={state.busy} onClose={() => setEditingPreset(null)}>
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <BossPresetForm
            characters={state.characters}
            initial={editingPreset}
            busy={state.busy}
            onCancel={() => setEditingPreset(null)}
            onSave={async (input) => {
              const saved = await state.mutate(
                () => bossesApi.updatePreset({ ...input, id: editingPreset.id }),
                '프리셋을 수정했습니다. 기존 주차 기록은 유지했습니다.'
              )
              if (saved) setEditingPreset(null)
              return saved
            }}
          />
        </Dialog>
      )}
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
      {selling && (
        <Dialog title="결정석 판매 기록" busy={state.busy} onClose={() => setSelling(null)}>
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <CrystalSaleForm
            run={selling}
            busy={state.busy}
            onCancel={() => setSelling(null)}
            onSave={async (input) => {
              const saved = await state.mutate(
                () => bossesApi.settle(input),
                '결정석 판매와 연결 수입을 저장했습니다.'
              )
              if (saved) setSelling(null)
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
