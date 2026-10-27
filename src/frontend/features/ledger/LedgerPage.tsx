import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { FinancialSummary } from '../../components/FinancialSummary'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { RecordFilters } from '../../components/RecordFilters'
import { formatMeso, thisMonthQuery, ledgerLabel } from '../../lib/format'
import { useCharacters } from '../characters/useCharacters'
import { useLedger } from './useLedger'
import { ledgerApi } from './ledger.api'

import type { LedgerEntry } from '../../../shared/contracts/ledger.contract'
import type { ExpenseInput } from '../../../shared/contracts/expense.contract'
import { ExpenseForm } from './ExpenseForm'
import { IncomeForm } from './IncomeForm'
import type { IncomeInput } from '../../../shared/contracts/income.contract'
import { useInputProtection } from '../../components/InputProtection'
import { QueryFailure } from '../../components/ui/QueryFailure'
import { useTaskNotifications } from '../../components/TaskNotifications'
import { useViewState, useMissingCharacterReset } from '../../components/ViewState'
import { resolveLedgerPage } from '../../../shared/view-state'
import { EnhancementImport } from './EnhancementImport'

export function LedgerPage() {
  const [enhancementsOpen, setEnhancementsOpen] = useState(false)
  const tasks = useTaskNotifications()
  const { request } = useInputProtection()
  const [editor, setEditor] = useState<LedgerEntry | 'new-expense' | 'new-income' | null>(null)
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const mutationLock = useRef(false)
  const [view, setView] = useViewState('ledger', () => ({ query: thisMonthQuery(), page: 1 }))
  const { query, page } = view
  const setQuery = (query: typeof view.query) => setView({ query, page: 1 })
  const setPage = (page: number) => setView((current) => ({ ...current, page }))
  const state = useLedger(query, page, (resolvedPage, requestedQuery, requestedPage) =>
    setView((current) => resolveLedgerPage(current, requestedQuery, requestedPage, resolvedPage))
  )
  const incomeGroups =
    state.data?.incomeGroups ??
    (['boss', 'hunting', 'income'] as const).map((activity) => ({ activity, amount: 0, count: 0 }))
  const detailEntries = state.data?.entries ?? []
  const pagination = state.data?.pagination
  const detailSection = useRef<HTMLElement>(null)
  const scrollAfterPage = useRef(false)
  useEffect(() => {
    if (state.error) scrollAfterPage.current = false
    if (state.data && !state.loading && scrollAfterPage.current) {
      detailSection.current?.scrollIntoView({ block: 'start' })
      scrollAfterPage.current = false
    }
  }, [state.data, state.loading, state.error])
  function changePage(next: number) {
    scrollAfterPage.current = true
    setPage(next)
  }
  const characters = useCharacters()
  useMissingCharacterReset(
    query.characterId,
    characters.characters,
    characters.loaded && !characters.loading,
    () =>
      setView((current) => ({ query: { from: current.query.from, to: current.query.to }, page: 1 }))
  )
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState(''),
    [exportNotice, setExportNotice] = useState('')
  const exportLock = useRef(false),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function saveEntry(input: ExpenseInput | IncomeInput, requestId: string): Promise<boolean> {
    if (mutationLock.current) return false
    mutationLock.current = true
    setSaving(true)
    setSaveError('')
    try {
      const isIncome =
        editor === 'new-income' || (typeof editor === 'object' && editor?.source === 'manualIncome')
      if (isIncome) {
        if (typeof editor === 'object' && editor)
          await ledgerApi.updateIncome({ ...(input as IncomeInput), id: editor.manualIncomeId! })
        else await ledgerApi.createIncome({ ...(input as IncomeInput), requestId })
      } else {
        if (typeof editor === 'object' && editor)
          await ledgerApi.updateExpense({ ...(input as ExpenseInput), id: editor.manualExpenseId! })
        else await ledgerApi.createExpense({ ...(input as ExpenseInput), requestId })
      }
      setEditor(null)
      if (typeof editor === 'string') setPage(1)
      setNotice(
        input.date < query.from ||
          input.date > query.to ||
          (query.characterId && query.characterId !== input.characterId)
          ? `${isIncome ? '수익' : '지출'}을 저장했습니다. 현재 조회 조건 밖의 기록이므로 기간·캐릭터를 변경해 확인하세요.`
          : `${isIncome ? '수익' : '지출'}을 저장했습니다.`
      )
      state.reload()
      return true
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : '거래를 저장하지 못했습니다.')
      return false
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }
  async function removeEntry() {
    if (mutationLock.current || (!deleting?.manualExpenseId && !deleting?.manualIncomeId)) return
    mutationLock.current = true
    setSaving(true)
    setSaveError('')
    try {
      if (deleting!.manualIncomeId) await ledgerApi.removeIncome(deleting!.manualIncomeId)
      else await ledgerApi.removeExpense(deleting!.manualExpenseId!)
      setDeleting(null)
      setNotice(`${deleting!.direction === 'income' ? '수익' : '지출'}을 삭제했습니다.`)
      state.reload()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : '거래를 삭제하지 못했습니다.')
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }
  async function exportCsv() {
    if (exportLock.current) return
    exportLock.current = true
    setExporting(true)
    setExportError('')
    setExportNotice('')
    const task = tasks.begin('거래 CSV 저장')
    try {
      const result = await ledgerApi.exportCsv(query)
      if (result) task.finish('success', `거래 ${result.count}건을 CSV 파일로 저장했습니다.`)
      else task.cancel()
      if (result && mounted.current)
        setExportNotice(
          `${query.from} ~ ${query.to} 거래 ${result.count}건을 저장했습니다: ${result.filePath}`
        )
    } catch (caught) {
      task.finish('error', 'CSV 파일을 저장하지 못했습니다. 다시 시도해 주세요.')
      if (mounted.current)
        setExportError(caught instanceof Error ? caught.message : 'CSV를 저장하지 못했습니다.')
    } finally {
      exportLock.current = false
      if (mounted.current) setExporting(false)
    }
  }
  return (
    <div className="space-y-5">
      <RecordFilters
        key={`${query.from}:${query.to}:${query.characterId ?? ''}`}
        initial={query}
        characters={characters.characters}
        busy={state.loading || characters.loading || exporting || saving}
        onApply={(next) => {
          setNotice('')
          setExportNotice('')
          setExportError('')
          setQuery(next)
          scrollAfterPage.current = false
        }}
      />
      <section
        aria-label="거래 추가"
        className="space-y-4 rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">거래 기록</h2>
            <p className="mt-2 text-xs text-muted">보스·사냥 외 수익과 지출을 직접 기록하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={saving || exporting || characters.loading || !characters.characters.length}
              onClick={() =>
                request(() => {
                  setEditor(null)
                  setDeleting(null)
                  setEnhancementsOpen(true)
                })
              }
            >
              강화 지출 가져오기
            </Button>
            <Button
              disabled={
                state.loading ||
                characters.loading ||
                exporting ||
                saving ||
                !characters.loaded ||
                !characters.characters.length
              }
              onClick={() =>
                request(() => {
                  setEditor('new-income')
                  setDeleting(null)
                  setSaveError('')
                  setNotice('')
                })
              }
            >
              수익 추가
            </Button>
            <Button
              variant="secondary"
              disabled={
                state.loading ||
                characters.loading ||
                exporting ||
                saving ||
                !characters.loaded ||
                !characters.characters.length
              }
              onClick={() =>
                request(() => {
                  setEditor('new-expense')
                  setDeleting(null)
                  setSaveError('')
                  setNotice('')
                })
              }
            >
              지출 추가
            </Button>
          </div>
        </div>
        {enhancementsOpen && <EnhancementImport onClose={() => setEnhancementsOpen(false)} />}
        {editor &&
          (editor === 'new-income' ||
          (typeof editor === 'object' && editor.source === 'manualIncome') ? (
            <IncomeForm
              key={typeof editor === 'object' ? editor.id : editor}
              characters={characters.characters}
              initial={typeof editor === 'object' ? editor : undefined}
              preferredCharacterId={query.characterId}
              busy={saving || exporting || characters.loading}
              onSave={saveEntry}
              onCancel={() => {
                setEditor(null)
                setSaveError('')
              }}
            />
          ) : (
            <ExpenseForm
              key={typeof editor === 'object' ? editor.id : editor}
              characters={characters.characters}
              initial={typeof editor === 'object' ? editor : undefined}
              preferredCharacterId={query.characterId}
              busy={saving || exporting || characters.loading}
              onSave={saveEntry}
              onCancel={() => {
                setEditor(null)
                setSaveError('')
              }}
            />
          ))}
      </section>
      {exportNotice && (
        <p
          role="status"
          className="break-all rounded-xl bg-brand-soft p-4 text-xs leading-6 text-brand"
        >
          {exportNotice}
        </p>
      )}
      {exportError && (
        <p role="alert" className="text-xs text-expense">
          {exportError}
        </p>
      )}
      {characters.loadError && (
        <QueryFailure
          label="캐릭터 목록"
          message={characters.loadError}
          onRetry={() => void characters.reload()}
          busy={characters.loading || saving}
        />
      )}
      {saveError && (
        <p role="alert" className="text-xs text-expense">
          {saveError}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-brand-soft p-4 text-xs text-brand">
          {notice}
        </p>
      )}
      {deleting && (
        <section aria-label="거래 삭제 확인" className="rounded-xl border border-expense p-4">
          <p className="text-xs">
            {deleting.date} · {deleting.characterName} · {ledgerLabel(deleting)} ·{' '}
            {formatMeso(deleting.amount)} 메소 {deleting.direction === 'income' ? '수익' : '지출'}을
            삭제할까요?
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={saving} onClick={() => void removeEntry()}>
              삭제 확인
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setDeleting(null)
                setSaveError('')
              }}
            >
              취소
            </Button>
          </div>
        </section>
      )}
      <FinancialSummary summary={state.data?.summary} loading={state.loading} />
      <section aria-label="묶음 수익" className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">수익 요약</h2>
        <p className="mt-2 text-[11px] leading-5 text-muted">
          조회 기간·캐릭터의 수입을 보스·사냥·직접 수익으로 표시합니다. 보스 수익은 결정과 보스 드랍
          판매, 사냥 수익은 획득 메소와 사냥 드랍 판매를 포함합니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {incomeGroups.map((group) => (
            <article key={group.activity} className="rounded-xl bg-brand-soft p-4">
              <h3 className="text-xs font-semibold">
                {group.activity === 'boss'
                  ? '보스 수익'
                  : group.activity === 'hunting'
                    ? '사냥 수익'
                    : '직접 수익'}
              </h3>
              <p className="mt-3 text-lg font-semibold tabular-nums text-brand">
                {state.loading || !state.data ? '—' : formatMeso(group.amount)}{' '}
                <span className="text-xs font-normal">메소</span>
              </p>
              {!state.loading && state.data && <MesoAmountHint value={group.amount} />}
              <p className="mt-2 text-[11px] text-muted">
                {state.loading
                  ? '조회 중…'
                  : !state.data
                    ? '수익 확인 불가'
                    : `원본 수입 ${group.count}건 합산`}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section
        ref={detailSection}
        aria-label="수익·지출 내역"
        aria-busy={state.loading}
        className="rounded-2xl border border-line bg-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold">수익·지출 내역</h2>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              직접 기록한 수익과 지출을 확인하고 수정·삭제할 수 있습니다. 메이플포인트 지출은 입력한
              환전비로 메소에 합산합니다. 이전 사냥 비용은 사냥 장부에서 관리합니다.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              CSV는 조회 조건에 맞는 수입·지출 원본 거래 전체를 저장합니다. 엑셀에서 15자리 초과
              금액을 다룰 때는 금액 열을 텍스트로 가져오세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={state.loading || characters.loading || exporting || saving || !state.data}
              onClick={() => void exportCsv()}
            >
              {exporting ? 'CSV 저장 중…' : 'CSV 내보내기'}
            </Button>
            <Button
              variant="secondary"
              disabled={state.loading || exporting || saving}
              onClick={state.reload}
            >
              새로고침
            </Button>
          </div>
        </div>
        {state.loading ? (
          <p role="status" className="p-10 text-center text-sm text-muted">
            거래 내역을 불러오는 중…
          </p>
        ) : !state.data ? (
          <QueryFailure
            label="거래 내역"
            message={state.error}
            onRetry={state.reload}
            busy={saving || exporting}
          />
        ) : detailEntries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-line bg-canvas/60 text-muted">
                <tr>
                  {['날짜', '캐릭터', '분류 · 메모', '금액', '관리'].map((label) => (
                    <th key={label} scope="col" className="px-6 py-4 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-4">{entry.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="block font-medium">{entry.characterName}</span>
                          <span className="mt-1 block text-[11px] text-muted">
                            {entry.characterWorld}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span>{ledgerLabel(entry)}</span>
                      {entry.notes && (
                        <p className="mt-1 max-w-xs whitespace-pre-wrap break-words text-[11px] text-muted">
                          {entry.notes}
                        </p>
                      )}
                    </td>
                    <td
                      className={`px-6 py-4 font-semibold tabular-nums ${entry.direction === 'income' ? 'text-brand' : 'text-expense'}`}
                    >
                      {entry.direction === 'income' ? '+' : '−'}
                      {formatMeso(entry.amount)} 메소
                      {entry.expenseCurrency === 'maplePoint' && (
                        <p className="mt-2 text-[11px] font-normal leading-5 text-muted">
                          {formatMeso(entry.pointAmount!)} 메이플포인트
                          <br />
                          1억 메소 = {formatMeso(entry.pointsPer100m!)} 포인트
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {entry.source === 'manual' || entry.source === 'manualIncome' ? (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            disabled={saving || exporting || state.loading}
                            onClick={() =>
                              request(() => {
                                setEditor(entry)
                                setDeleting(null)
                                setSaveError('')
                                setNotice('')
                              })
                            }
                          >
                            수정
                          </Button>
                          <Button
                            variant="danger"
                            disabled={saving || exporting || state.loading}
                            onClick={() =>
                              request(
                                () => {
                                  setDeleting(entry)
                                  setEditor(null)
                                  setSaveError('')
                                  setNotice('')
                                },
                                undefined,
                                'discard'
                              )
                            }
                          >
                            삭제
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted">사냥 장부에서 관리</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="ledger"
            title="조회 기간에 직접 수익·지출 내역이 없어요"
            description="위의 수익 추가·지출 추가 버튼으로 거래를 기록하세요. 캐릭터가 없다면 먼저 등록해 주세요."
          />
        )}
        {pagination && pagination.total > 0 && (
          <nav
            aria-label="거래 내역 페이지"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4"
          >
            <p role="status" className="text-xs tabular-nums text-muted">
              총 {formatMeso(pagination.total)}건 중{' '}
              {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}건 ·{' '}
              {pagination.page} / {pagination.totalPages}페이지
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={
                  state.loading ||
                  saving ||
                  exporting ||
                  !!editor ||
                  !!deleting ||
                  pagination.page <= 1
                }
                onClick={() => changePage(pagination.page - 1)}
              >
                이전
              </Button>
              <Button
                variant="secondary"
                disabled={
                  state.loading ||
                  saving ||
                  exporting ||
                  !!editor ||
                  !!deleting ||
                  pagination.page >= pagination.totalPages
                }
                onClick={() => changePage(pagination.page + 1)}
              >
                다음
              </Button>
            </div>
          </nav>
        )}
      </section>
    </div>
  )
}
