import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { FinancialSummary } from '../../components/FinancialSummary'
import { RecordFilters } from '../../components/RecordFilters'
import { formatMeso, thisMonthQuery, ledgerLabel } from '../../lib/format'
import { useCharacters } from '../characters/useCharacters'
import { useLedger } from './useLedger'
import { ledgerApi } from './ledger.api'

export function LedgerPage() {
  const [query, setQuery] = useState(thisMonthQuery)
  const state = useLedger(query)
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
        busy={state.loading || characters.loading || exporting}
        onApply={(next) => {
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
      <FinancialSummary summary={state.data?.summary} loading={state.loading} />
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold">수입과 지출</h2>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              사냥·결정석·드랍 판매에서 생성된 거래입니다. 수정·취소는 원본 활동의 장부에서
              진행하세요.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              CSV는 마지막으로 조회한 기간·캐릭터 조건으로 저장합니다. 엑셀에서 15자리 초과 금액을
              다룰 때는 금액 열을 텍스트로 가져오세요.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={state.loading || characters.loading || exporting || !state.data}
              onClick={() => void exportCsv()}
            >
              {exporting ? 'CSV 저장 중…' : 'CSV 내보내기'}
            </Button>
            <Button
              variant="secondary"
              disabled={state.loading || exporting}
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
        ) : state.data?.entries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-line bg-canvas/60 text-muted">
                <tr>
                  {['날짜', '캐릭터', '분류', '금액'].map((label) => (
                    <th key={label} scope="col" className="px-6 py-4 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-4">{entry.date}</td>
                    <td className="px-6 py-4">
                      <span className="block font-medium">{entry.characterName}</span>
                      <span className="mt-1 block text-[11px] text-muted">
                        {entry.characterWorld}
                      </span>
                    </td>
                    <td className="px-6 py-4">{ledgerLabel(entry)}</td>
                    <td
                      className={`px-6 py-4 font-semibold tabular-nums ${entry.direction === 'income' ? 'text-brand' : 'text-expense'}`}
                    >
                      {entry.direction === 'income' ? '+' : '−'}
                      {formatMeso(entry.amount)} 메소
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="ledger"
            title="조회 기간에 거래 내역이 없어요"
            description="사냥 기록이나 보스 클리어·드랍 판매를 저장하면 거래가 표시됩니다. 미판매 아이템의 예상 가치는 실제 수입에 포함하지 않습니다."
          />
        )}
      </section>
    </div>
  )
}
