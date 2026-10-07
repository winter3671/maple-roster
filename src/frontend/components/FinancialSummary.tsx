import type { LedgerSummary } from '../../shared/contracts/ledger.contract'
import { formatMeso } from '../lib/format'

export function FinancialSummary({
  summary,
  loading = false,
  prefix = '조회 기간'
}: {
  summary?: LedgerSummary
  loading?: boolean
  prefix?: string
}) {
  const cards = [
    {
      label: `${prefix} 실제 수입`,
      value: summary?.income,
      detail: '직접 획득한 메소',
      color: 'text-brand'
    },
    {
      label: `${prefix} 지출`,
      value: summary?.expense,
      detail: '사냥에 사용한 비용',
      color: 'text-expense'
    },
    {
      label: `${prefix} 순수익`,
      value: summary?.net,
      detail: '실제 수입 − 지출',
      color: 'text-ink'
    }
  ]
  return (
    <section aria-label="수익 요약" className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <article key={card.label} className="min-w-0 rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">{card.label}</p>
          <p className={`my-4 break-all text-xl font-semibold tabular-nums ${card.color}`}>
            {loading || card.value === undefined ? '—' : formatMeso(card.value)}
            <span className="ml-2 text-[11px] font-normal text-muted">메소</span>
          </p>
          <p className="text-[11px] text-muted">{card.detail}</p>
        </article>
      ))}
    </section>
  )
}
