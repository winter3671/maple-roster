import { useId } from 'react'
import { auctionFee, type AuctionFeeRate } from '../../../shared/auction-fee'
import { formatMeso } from '../../lib/format'
import { MesoAmountHint } from '../../components/MesoAmountHint'

export function HuntingSaleFeeField({
  rate,
  grossAmount,
  busy,
  onChange
}: {
  rate: AuctionFeeRate
  grossAmount: number
  busy: boolean
  onChange: (rate: AuctionFeeRate) => void
}) {
  const id = useId()
  const valid = Number.isSafeInteger(grossAmount) && grossAmount >= 0
  const fee = valid ? auctionFee(grossAmount, rate) : null
  const net = fee === null ? null : grossAmount - fee
  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-fee`} className="text-xs">
          판매 수수료
        </label>
        <div className="group relative">
          <button
            type="button"
            aria-label="판매 수수료 안내"
            aria-describedby={`${id}-help`}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs text-muted focus-visible:outline-brand"
          >
            ?
          </button>
          <div
            id={`${id}-help`}
            role="tooltip"
            className="invisible absolute bottom-full left-0 z-10 mb-2 w-64 max-w-[70vw] rounded-xl border border-line bg-surface p-3 text-xs leading-6 text-ink shadow-lg group-hover:visible group-focus-within:visible"
          >
            기본 판매 수수료는 5%입니다. 판매 대금을 수령하는 시점에 MVP 실버 등급 이상이거나
            프리미엄 PC방을 이용 중이면 3%가 적용됩니다.
          </div>
        </div>
        <select
          id={`${id}-fee`}
          value={rate}
          disabled={busy}
          onChange={(event) => onChange(Number(event.target.value) === 5 ? 5 : 3)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value={3}>3%</option>
          <option value={5}>5%</option>
        </select>
      </div>
      <div className="rounded-lg bg-brand-soft p-3 text-xs leading-6">
        <p className="text-muted">수수료: {fee === null ? '—' : `${formatMeso(fee)} 메소`}</p>
        <p className="font-semibold text-brand">
          실제 반영 수익: {net === null ? '—' : `${formatMeso(net)} 메소`}
        </p>
        {net !== null && <MesoAmountHint value={net} />}
      </div>
    </div>
  )
}
