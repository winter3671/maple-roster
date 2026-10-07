import { useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { FinancialSummary } from '../../components/FinancialSummary'
import { RecordFilters } from '../../components/RecordFilters'
import { formatMeso, thisMonthQuery } from '../../lib/format'
import { useCharacters } from '../characters/useCharacters'
import { useLedger } from './useLedger'

export function LedgerPage() {
  const [query, setQuery] = useState(thisMonthQuery)
  const state = useLedger(query)
  const characters = useCharacters()
  return (
    <div className="space-y-5">
      <RecordFilters
        initial={query}
        characters={characters.characters}
        busy={state.loading || characters.loading}
        onApply={setQuery}
      />
      {(state.error || characters.error) && (
        <p role="alert" className="text-xs text-expense">
          {state.error || characters.error}
        </p>
      )}
      <FinancialSummary summary={state.data?.summary} loading={state.loading} />
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold">수입과 지출</h2>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              사냥 회차에서 자동 생성된 거래입니다. 수정·삭제는 사냥 장부에서 진행하세요.
            </p>
          </div>
          <Button variant="secondary" disabled={state.loading} onClick={state.reload}>
            새로고침
          </Button>
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
                    <td className="px-6 py-4">
                      {entry.direction === 'income' ? '사냥 획득' : '사냥 소모 비용'}
                    </td>
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
            description="사냥 회차를 저장하면 획득 메소와 소모 비용이 이곳에 표시됩니다. 아이템 획득 수량은 메소 수입에 포함하지 않습니다."
          />
        )}
      </section>
    </div>
  )
}
