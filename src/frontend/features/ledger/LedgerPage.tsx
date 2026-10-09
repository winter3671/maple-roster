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
import { groupLedgerIncome } from '../../../shared/ledger-income'

import type { LedgerEntry } from '../../../shared/contracts/ledger.contract'
import type { ExpenseInput } from '../../../shared/contracts/expense.contract'
import { ExpenseForm } from './ExpenseForm'

export function LedgerPage() {
  const [editor, setEditor] = useState<LedgerEntry | 'new' | null>(null)
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const mutationLock = useRef(false)
  const [query, setQuery] = useState(thisMonthQuery)
  const state = useLedger(query)
  const incomeGroups = groupLedgerIncome(state.data?.entries ?? [])
  const expenses = state.data?.entries.filter((entry) => entry.direction === 'expense') ?? []
  const characters = useCharacters()
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
  async function saveExpense(input: ExpenseInput, requestId: string): Promise<boolean> {
    if (mutationLock.current) return false
    mutationLock.current = true
    setSaving(true)
    setSaveError('')
    try {
      if (editor && editor !== 'new')
        await ledgerApi.updateExpense({ ...input, id: editor.manualExpenseId! })
      else await ledgerApi.createExpense({ ...input, requestId })
      setEditor(null)
      setNotice(
        input.date < query.from ||
          input.date > query.to ||
          (query.characterId && query.characterId !== input.characterId)
          ? '지출을 저장했습니다. 현재 조회 조건 밖의 기록이므로 기간·캐릭터를 변경해 확인하세요.'
          : '지출을 저장했습니다.'
      )
      state.reload()
      return true
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : '지출을 저장하지 못했습니다.')
      return false
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }
  async function removeExpense() {
    if (mutationLock.current || !deleting?.manualExpenseId) return
    mutationLock.current = true
    setSaving(true)
    setSaveError('')
    try {
      await ledgerApi.removeExpense(deleting.manualExpenseId)
      setDeleting(null)
      setNotice('지출을 삭제했습니다.')
      state.reload()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : '지출을 삭제하지 못했습니다.')
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
    try {
      const result = await ledgerApi.exportCsv(query)
      if (result && mounted.current)
        setExportNotice(
          `${query.from} ~ ${query.to} 거래 ${result.count}건을 저장했습니다: ${result.filePath}`
        )
    } catch (caught) {
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
        initial={query}
        characters={characters.characters}
        busy={state.loading || characters.loading || exporting || saving}
        onApply={(next) => {
          setNotice('')
          setExportNotice('')
          setExportError('')
          setQuery(next)
        }}
      />
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
      {(state.error || characters.error) && (
        <p role="alert" className="text-xs text-expense">
          {state.error || characters.error}
        </p>
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
      {editor && (
        <ExpenseForm
          key={editor === 'new' ? 'new' : editor.id}
          characters={characters.characters}
          initial={editor === 'new' ? undefined : editor}
          preferredCharacterId={query.characterId}
          busy={saving || exporting}
          onSave={saveExpense}
          onCancel={() => {
            setEditor(null)
            setSaveError('')
          }}
        />
      )}
      {deleting && (
        <section aria-label="지출 삭제 확인" className="rounded-xl border border-expense p-4">
          <p className="text-xs">
            {deleting.date} · {deleting.characterName} · {ledgerLabel(deleting)} ·{' '}
            {formatMeso(deleting.amount)} 메소 지출을 삭제할까요?
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={saving} onClick={() => void removeExpense()}>
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
          조회 기간·캐릭터의 수입을 두 묶음으로 표시합니다. 보스 수익은 결정석과 보스 드랍 판매,
          사냥 수익은 획득 메소와 사냥 드랍 판매를 포함합니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {incomeGroups.map((group) => (
            <article key={group.activity} className="rounded-xl bg-brand-soft p-4">
              <h3 className="text-xs font-semibold">
                {group.activity === 'boss' ? '보스 수익' : '사냥 수익'}
              </h3>
              <p className="mt-3 text-lg font-semibold tabular-nums text-brand">
                {state.loading ? '—' : formatMeso(group.amount)}{' '}
                <span className="text-xs font-normal">메소</span>
              </p>
              {!state.loading && <MesoAmountHint value={group.amount} />}
              <p className="mt-2 text-[11px] text-muted">
                {state.loading ? '조회 중…' : `원본 수입 ${group.count}건 합산`}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold">지출 내역</h2>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              장비 구매·강화 등 사용한 메소나 메이플포인트를 직접 기록하세요. 포인트는 입력한
              환전비로 메소에 합산합니다. 이전 사냥 비용은 사냥 장부에서 관리합니다.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              CSV는 조회 조건에 맞는 수입·지출 원본 거래 전체를 저장합니다. 엑셀에서 15자리 초과
              금액을 다룰 때는 금액 열을 텍스트로 가져오세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                state.loading ||
                characters.loading ||
                exporting ||
                saving ||
                !characters.characters.length
              }
              onClick={() => {
                setEditor('new')
                setDeleting(null)
                setSaveError('')
                setNotice('')
              }}
            >
              지출 추가
            </Button>
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
        ) : expenses.length ? (
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
                {expenses.map((entry) => (
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
                      {entry.source === 'manual' ? (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            disabled={saving || exporting || state.loading}
                            onClick={() => {
                              setEditor(entry)
                              setDeleting(null)
                              setSaveError('')
                              setNotice('')
                            }}
                          >
                            수정
                          </Button>
                          <Button
                            variant="danger"
                            disabled={saving || exporting || state.loading}
                            onClick={() => {
                              setDeleting(entry)
                              setEditor(null)
                              setSaveError('')
                              setNotice('')
                            }}
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
            title="조회 기간에 지출 내역이 없어요"
            description="지출 추가 버튼으로 사용한 메소를 기록하세요. 캐릭터가 없다면 먼저 등록해 주세요."
          />
        )}
      </section>
    </div>
  )
}
