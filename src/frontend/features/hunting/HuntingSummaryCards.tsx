import type { HuntingSummary } from '../../../shared/contracts/hunting.contract'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { formatMeso } from '../../lib/format'

export function HuntingSummaryCards({
  summary,
  loading
}: {
  summary?: HuntingSummary
  loading: boolean
}) {
  const cards = [
    {
      label: '순수 메소 수익',
      value: summary?.mesos,
      unit: '메소',
      detail: '사냥에서 직접 획득한 메소'
    },
    {
      label: '솔 에르다 조각 획득량',
      value: summary?.solFragments,
      unit: '개',
      detail: `미판매 ${formatMeso((summary?.solFragments ?? 0) - (summary?.solFragmentsSold ?? 0))}개`
    },
    {
      label: '솔 에르다 조각 판매량',
      value: summary?.solFragmentsSold,
      unit: '개',
      detail: '조회한 사냥 회차에서 얻은 조각의 판매 수량'
    },
    {
      label: '솔 에르다 조각 판매 수익',
      value: summary?.solFragmentsSaleIncome,
      unit: '메소',
      detail: '판매가 완료된 조각의 실제 수입'
    }
  ]
  return (
    <section
      aria-label="사냥 수익과 조각 요약"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <article key={card.label} className="min-w-0 rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">{card.label}</p>
          <p className="mb-1 mt-4 break-all text-xl font-semibold tabular-nums text-brand">
            {loading || card.value === undefined ? '—' : formatMeso(card.value)}
            <span className="ml-2 text-[11px] font-normal text-muted">{card.unit}</span>
          </p>
          {!loading && card.value !== undefined && card.unit === '메소' && (
            <MesoAmountHint value={card.value} />
          )}
          <p className="mt-3 text-[11px] leading-5 text-muted">
            {loading ? '조회 중…' : card.detail}
          </p>
        </article>
      ))}
    </section>
  )
}
