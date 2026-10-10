import { useEffect, useRef, useState } from 'react'
import {
  bossPeriod,
  bossPeriodEnd,
  shiftDate,
  shiftMonth,
  type BossCycle
} from '../../../shared/boss-period'
import {
  parseBossQuery,
  type BossRun,
  type BossQuery
} from '../../../shared/contracts/boss.contract'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { BossRunForm } from './BossRunForm'
import { BossRunGroups } from './BossRunGroups'
import { BossIncomeDateForm } from './BossIncomeDateForm'
import { BossClearPreview } from './BossClearPreview'
import type {
  BossSyncPreview,
  BossBatchSyncResult
} from '../../../shared/contracts/boss-sync.contract'
import { getKstDate } from '../../../shared/dates'
import type { Character } from '../../../shared/contracts/character.contract'
import { bossesApi } from './bosses.api'
import { useBosses } from './useBosses'
import { DropManager } from '../drops/DropManager'

type Confirmation = {
  title: string
  description: string
  action: () => Promise<unknown>
  message: string
}
export function BossesPage({ cycle = 'weekly' }: { cycle?: BossCycle }) {
  const monthly = cycle === 'monthly'
  const periodLabel = monthly ? '월간' : '주간'
  const currentPeriod = () => bossPeriod(getKstDate(), cycle)
  const [query, setQuery] = useState<BossQuery>(() => ({ date: currentPeriod(), cycle }))
  const state = useBosses(query)
  const [periodError, setPeriodError] = useState('')
  const [editingRun, setEditingRun] = useState<BossRun | null>(null)
  const [editingIncomeDate, setEditingIncomeDate] = useState<BossRun | null>(null)
  const [addingCharacter, setAddingCharacter] = useState<Character | null>(null)
  const [drops, setDrops] = useState<BossRun | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [apiPreview, setApiPreview] = useState<BossSyncPreview | null>(null)
  const [apiBusy, setApiBusy] = useState(false)
  const [apiError, setApiError] = useState('')
  const [batchResult, setBatchResult] = useState<BossBatchSyncResult | null>(null)
  const [partyNotice, setPartyNotice] = useState(false)
  const apiLock = useRef(false),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const disabled = state.loading || state.busy || apiBusy
  const week = bossPeriod(query.date, cycle)
  const modal = Boolean(
    editingRun || editingIncomeDate || addingCharacter || confirmation || apiPreview || partyNotice
  )
  const canSyncApi =
    week <= currentPeriod() && bossPeriodEnd(week, cycle) >= shiftDate(getKstDate(), -14)
  async function queryApi(character: Character) {
    if (monthly) {
      if (apiLock.current) return
      apiLock.current = true
      setApiBusy(true)
      setApiError('')
      setBatchResult(null)
      try {
        const result = await bossesApi.syncClears(week, cycle, character.id)
        if (mounted.current) {
          setBatchResult(result)
          if (result.items.some((row) => (row.added ?? 0) > 0)) setPartyNotice(true)
        }
      } catch (caught) {
        if (mounted.current)
          setApiError(caught instanceof Error ? caught.message : 'API 확인에 실패했습니다.')
      } finally {
        await state.reload()
        apiLock.current = false
        if (mounted.current) setApiBusy(false)
      }
      return
    }
    if (apiLock.current) return
    apiLock.current = true
    setApiBusy(true)
    setApiError('')
    state.clearFeedback()
    try {
      const preview = await bossesApi.previewClears(week, character.id)
      if (mounted.current) setApiPreview(preview)
    } catch (caught) {
      if (mounted.current)
        setApiError(caught instanceof Error ? caught.message : 'API 클리어 조회에 실패했습니다.')
    } finally {
      apiLock.current = false
      if (mounted.current) setApiBusy(false)
    }
  }
  function confirm(value: Confirmation) {
    state.clearFeedback()
    setConfirmation(value)
  }
  return (
    <div className="space-y-5">
      {partyNotice && (
        <Dialog title="API 보스 클리어 인원 안내" onClose={() => setPartyNotice(false)}>
          <p className="text-sm leading-6">
            API에서 새로 등록한 보스는 기본 1인 클리어 기준으로 수익을 계산합니다. 다인 파티로
            클리어했다면 보스명·난이도·인원을 눌러 클리어 인원을 수정해 주세요.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            넥슨 API는 클리어 인원을 제공하지 않습니다. 기존 기록의 인원과 직접 지정한 인원은
            유지됩니다.
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setPartyNotice(false)}>확인</Button>
          </div>
        </Dialog>
      )}
      {apiBusy && (
        <p role="status" className="rounded-xl bg-brand-soft p-4 text-xs text-brand">
          API 보스 클리어를 조회하고 있습니다. 일괄 확인은 캐릭터별로 순서대로 반영합니다…
        </p>
      )}
      {apiError && (
        <p role="alert" className="rounded-xl bg-expense/5 p-4 text-xs text-expense">
          {apiError}
        </p>
      )}
      {batchResult && (
        <section
          aria-label="API 일괄 확인 결과"
          className="space-y-2 rounded-xl border border-line bg-surface p-4 text-xs leading-6"
        >
          <p role="status" className="font-semibold text-brand">
            {monthly ? batchResult.week.slice(0, 7) + ' 월간' : batchResult.week + ' 주차'} · 확인{' '}
            {batchResult.items.filter((item) => item.status === 'synced').length}명 · 새 클리어{' '}
            {batchResult.items.reduce((sum, item) => sum + (item.applied ?? 0), 0)}개 · 실패{' '}
            {batchResult.items.filter((item) => item.status === 'failed').length}명 · 미처리{' '}
            {batchResult.items.filter((item) => item.status === 'notAttempted').length}명 · API
            미연결 {batchResult.items.filter((item) => item.status === 'unlinked').length}명
          </p>
          <p className="text-muted">
            수익 반영일 {batchResult.incomeDate} · API에 클리어 인원이 없어 새 보스는 1인 기준으로
            등록합니다. 다인 파티였다면 보스명·난이도·인원을 눌러 수정하세요. 기존 인원과 수동
            수익은 유지합니다.
          </p>
          {batchResult.items
            .filter((item) => item.error || item.removed)
            .map((item) => (
              <p key={item.characterId} className={item.error ? 'text-expense' : 'text-muted'}>
                {item.characterName} · {item.characterWorld}:{' '}
                {item.error?.message ??
                  `완료 보스를 추가하기 위해 메모·수익·드랍이 없는 미클리어 보스 ${item.removed}개를 제외했습니다.`}
              </p>
            ))}
        </section>
      )}
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
          {monthly ? '보스 기록 월' : '보스 주차 기준일'}
          <input
            aria-label={monthly ? '보스 기록 월' : '보스 주차 기준일'}
            type={monthly ? 'month' : 'date'}
            min={monthly ? '2000-02' : '2000-01-06'}
            value={monthly ? query.date.slice(0, 7) : query.date}
            disabled={disabled}
            onChange={(event) => {
              if (!event.target.value) return
              try {
                setQuery(
                  parseBossQuery({
                    ...query,
                    date: monthly ? event.target.value + '-01' : event.target.value
                  })
                )
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
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={disabled || week <= (monthly ? '2000-02-01' : '2000-01-06')}
          onClick={() =>
            setQuery({ ...query, date: monthly ? shiftMonth(week, -1) : shiftDate(week, -7) })
          }
        >
          {monthly ? '지난달' : '이전 주'}
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || week >= currentPeriod()}
          onClick={() =>
            setQuery({ ...query, date: monthly ? shiftMonth(week, 1) : shiftDate(week, 7) })
          }
        >
          {monthly ? '다음 달' : '다음 주'}
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => setQuery({ ...query, date: currentPeriod() })}
        >
          {monthly ? '이번 달' : '이번 주'}
        </Button>
        <p className="basis-full text-[11px] leading-5 text-muted">
          {week} ~ {bossPeriodEnd(week, cycle)} · {monthly ? '매월 1일' : '목요일'} 00시(KST) 기준 ·
          보스 진행도 및 정산에서 API 클리어 일괄 확인으로 주간·월간 기록을 함께 갱신합니다.{' '}
          {canSyncApi
            ? '캐릭터별 API 조회와 수동 기록도 사용할 수 있습니다.'
            : '최근 14일 범위 밖은 저장된 기록만 표시하며 API 조회를 지원하지 않습니다.'}
        </p>
      </section>
      {periodError && (
        <p role="alert" className="text-xs text-expense">
          {periodError}
        </p>
      )}
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5">
          <div>
            <h2 className="text-sm font-semibold">{periodLabel} 보스 기록</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              클리어를 체크하면 결정 수익이 바로 반영됩니다. 체크 해제 시 해당 수입도 취소됩니다.
              드랍 판매는 별도로 기록합니다.
            </p>
          </div>
        </div>
        {state.loading ? (
          <p role="status" className="p-10 text-center text-xs text-muted">
            보스 기록을 불러오는 중…
          </p>
        ) : state.characters.length ? (
          <BossRunGroups
            cycle={cycle}
            runs={state.data?.runs ?? []}
            characters={state.characters}
            characterId={query.characterId}
            busy={disabled}
            canAdd={week <= currentPeriod()}
            canQueryApi={
              week <= currentPeriod() && bossPeriodEnd(week, cycle) >= shiftDate(getKstDate(), -14)
            }
            onQueryApi={(character) => void queryApi(character)}
            onAdd={(character) => {
              state.clearFeedback()
              setAddingCharacter(character)
            }}
            onEdit={(run) => {
              state.clearFeedback()
              setEditingRun(run)
            }}
            onEditIncomeDate={(run) => {
              state.clearFeedback()
              setEditingIncomeDate(run)
            }}
            onDrops={setDrops}
            onClear={(run, value) =>
              void state.mutate(
                () => bossesApi.setClear(run.id, value),
                value ? '클리어와 결정 수익을 반영했습니다.' : '클리어와 결정 수익을 취소했습니다.'
              )
            }
            onDelete={(run) =>
              confirm({
                title: '보스 기록 삭제',
                description: `${run.characterName}의 ${run.bossName} 기록과 결정 수익을 이 기간에서 삭제합니다. 다른 기간는 유지됩니다.`,
                action: () => bossesApi.removeRun(run.id),
                message: `${periodLabel} 보스 기록을 삭제했습니다.`
              })
            }
          />
        ) : (
          <EmptyState
            icon="boss"
            title="등록된 캐릭터가 없어요"
            description="캐릭터를 먼저 등록한 뒤 API 클리어를 조회하거나 보스를 직접 추가하세요."
          />
        )}
      </section>
      {drops && (
        <DropManager
          source={{ kind: 'boss', id: drops.id }}
          title={`${drops.characterName} · ${drops.bossName}`}
          onClose={() => setDrops(null)}
          onChanged={state.reload}
        />
      )}
      {apiPreview && (
        <Dialog
          title="API 보스 클리어 확인"
          wide
          busy={state.busy}
          onClose={() => setApiPreview(null)}
        >
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <BossClearPreview
            preview={apiPreview}
            busy={state.busy}
            onCancel={() => setApiPreview(null)}
            onReplace={async (members, date) => {
              let added = 0
              const saved = await state.mutate(async () => {
                const result = await bossesApi.replaceClears(apiPreview.id, members, date)
                added = result.added ?? 0
              }, '이 기간를 API 완료 보스 목록으로 맞추고 결정 수익을 반영했습니다.')
              if (saved) {
                const newSolo = members.some(
                  (member) =>
                    member.partySize === 1 &&
                    !apiPreview.rows.some((row) => row.bossName === member.bossName)
                )
                setApiPreview(null)
                if (added > 0 && newSolo) setPartyNotice(true)
              }
            }}
            onApply={async (ids, date) => {
              const saved = await state.mutate(
                () => bossesApi.applyClears(apiPreview.id, ids, date),
                'API에서 확인한 클리어와 결정 수익을 반영했습니다.'
              )
              if (saved) setApiPreview(null)
            }}
          />
        </Dialog>
      )}
      {editingRun && (
        <Dialog
          title={`${periodLabel} 보스 기록 수정`}
          busy={state.busy}
          onClose={() => setEditingRun(null)}
        >
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <BossRunForm
            run={editingRun}
            unavailable={state.data?.runs
              .filter(
                (row) => row.characterId === editingRun.characterId && row.id !== editingRun.id
              )
              .map((row) => row.bossName)}
            busy={state.busy}
            onCancel={() => setEditingRun(null)}
            onSave={async (input) => {
              const saved = await state.mutate(
                () => bossesApi.updateRun(input),
                '이 기간의 보스 기록을 수정했습니다.'
              )
              if (saved) setEditingRun(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {editingIncomeDate && (
        <Dialog
          title="결정 수익 반영일 수정"
          busy={state.busy}
          onClose={() => setEditingIncomeDate(null)}
        >
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <BossIncomeDateForm
            run={editingIncomeDate}
            busy={state.busy}
            onCancel={() => setEditingIncomeDate(null)}
            onSave={async (input) => {
              const saved = await state.mutate(
                () => bossesApi.updateIncomeDate(input),
                '수익 반영일을 수정했습니다. 금액과 보스 기록 기간은 유지됩니다.'
              )
              if (saved) setEditingIncomeDate(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {addingCharacter && (
        <Dialog
          title={`${addingCharacter.name} 보스 추가`}
          busy={state.busy}
          onClose={() => setAddingCharacter(null)}
        >
          {state.error && (
            <p role="alert" className="mb-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <BossRunForm
            run={{
              id: '',
              characterId: addingCharacter.id,
              characterName: addingCharacter.name,
              characterWorld: addingCharacter.world,
              bossName: monthly ? '검은 마법사' : '',
              bossKey: '',
              difficulty: monthly ? '하드' : '',
              partySize: 1,
              crystalPrice: 0,
              expectedShare: 0,
              week,
              cycle,
              isCleared: false,
              partySizeNeedsReview: false,
              notes: '',
              settlement: null,
              createdAt: '',
              updatedAt: ''
            }}
            unavailable={state.data?.runs
              .filter((row) => row.characterId === addingCharacter.id)
              .map((row) => row.bossName)}
            busy={state.busy}
            onCancel={() => setAddingCharacter(null)}
            onSave={async (input) => {
              const saved = await state.mutate(
                () =>
                  bossesApi.createRun({
                    ...input,
                    bossName: input.bossName ?? '',
                    characterId: addingCharacter.id,
                    date: week,
                    cycle
                  }),
                '이 기간에 보스를 추가했습니다.'
              )
              if (saved) setAddingCharacter(null)
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
