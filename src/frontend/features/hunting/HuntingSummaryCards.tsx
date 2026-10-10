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
      detail: `판매 ${formatMeso(summary?.solFragmentsSold ?? 0)}개 · 미판매 ${formatMeso((summary?.solFragments ?? 0) - (summary?.solFragmentsSold ?? 0))}개`
    },
    {
      label: '솔 에르다 조각 판매 수익',
      value: summary?.solFragmentsSaleIncome,
      unit: '메소',
      detail: '판매가 완료된 조각의 실제 수입'
    },
    {
      label: '총 사냥 수입',
      value: summary?.income,
      unit: '메소',
      detail: '획득 메소 + 모든 사냥 드랍 판매 수익',
      emphasized: true
    }
  ]
  return (
    <section
      aria-label="사냥 수익과 조각 요약"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className={`min-w-0 rounded-2xl border p-5 ${card.emphasized ? 'border-brand/30 bg-brand-soft' : 'border-line bg-surface'}`}
        >
          <p className={`text-xs ${card.emphasized ? 'font-semibold text-brand' : 'text-muted'}`}>
            {card.label}
          </p>
          <p
            className={`mb-1 mt-4 break-all tabular-nums text-brand ${card.emphasized ? 'text-2xl font-bold' : 'text-xl font-semibold'}`}
          >
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
