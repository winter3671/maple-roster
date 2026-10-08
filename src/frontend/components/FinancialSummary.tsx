import type { LedgerSummary } from '../../shared/contracts/ledger.contract'
import { formatMeso } from '../lib/format'

export function FinancialSummary({
  summary,
  loading = false,
  prefix = '조회 기간',
  hideExpense = false
}: {
  summary?: LedgerSummary
  loading?: boolean
  prefix?: string
  hideExpense?: boolean
}) {
  const cards = [
    {
      label: `${prefix} 실제 수입`,
      value: summary?.income,
      detail: '장부에 확정된 수입',
      color: 'text-brand'
    },
    {
      label: `${prefix} 지출`,
      value: summary?.expense,
      detail: '장부에 기록된 지출',
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
    <section
      aria-label="수익 요약"
      className={`grid gap-4 ${hideExpense ? 'grid-cols-2' : 'grid-cols-3'}`}
    >
      {cards
        .filter((_, index) => !hideExpense || index !== 1)
        .map((card) => (
          <article
            key={card.label}
            className="min-w-0 rounded-2xl border border-line bg-surface p-5"
          >
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
