import { useState, type FormEvent } from 'react'
import type {
  DropLot,
  DropSale,
  HuntingDropSaleState
} from '../../../shared/contracts/drop.contract'
import { getKstDate } from '../../../shared/dates'
import { formatMeso, parseDigits } from '../../lib/format'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { Button } from '../../components/ui/Button'
import { useFormProtection } from '../../components/InputProtection'
import { auctionFee, type AuctionFeeRate } from '../../../shared/auction-fee'
import { readHuntingSaleFee, rememberHuntingSaleFee } from '../../lib/hunting-sale-fee'
import { HuntingSaleFeeField } from './HuntingSaleFeeField'

export function HuntingDropCard({
  lot,
  sales,
  busy,
  onSave
}: {
  lot: DropLot
  sales: DropSale[]
  busy: boolean
  onSave: (input: HuntingDropSaleState) => Promise<boolean>
}) {
  const [sold, setSold] = useState(lot.remaining === 0 && sales.length > 0)
  const savedGross = sales.reduce((sum, sale) => sum + sale.grossAmount, 0)
  const [amount, setAmount] = useState(String(savedGross || ''))
  const [unitPrice, setUnitPrice] = useState(
    savedGross && savedGross % lot.quantity === 0 ? String(savedGross / lot.quantity) : ''
  )
  const [feeRate, setFeeRate] = useState<AuctionFeeRate>(() => {
    if (sales.length === 1 && sales[0].feeAmount > 0)
      for (const rate of [3, 5] as const)
        if (auctionFee(sales[0].grossAmount, rate) === sales[0].feeAmount) return rate
    return readHuntingSaleFee()
  })
  const [error, setError] = useState('')
  const protection = useFormProtection({ sold, amount, unitPrice, feeRate }, busy)
  const [requestId] = useState(() => crypto.randomUUID())
  const field =
    'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50'
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const grossAmount = sold ? parseDigits(amount) : 0
    if (!Number.isSafeInteger(grossAmount) || grossAmount < 0) {
      setError('총 판매 금액은 0 이상의 정수로 입력해 주세요.')
      return
    }
    const date =
      sales
        .map((sale) => sale.date)
        .sort()
        .at(-1) ?? getKstDate()
    try {
      await protection.save(() =>
        onSave({ lotId: lot.id, sold, date, grossAmount, feeRate, requestId })
      )
    } catch {
      setError('판매 상태를 저장하지 못했습니다. 다시 시도해 주세요.')
    }
  }
  return (
    <form
      {...protection.formProps}
      onSubmit={(event) => void submit(event)}
      className="space-y-4 rounded-xl border border-line p-4"
    >
      <h3 className="text-sm font-semibold">
        {lot.itemName}{' '}
        <span className="ml-2 text-xs font-normal text-muted">{formatMeso(lot.quantity)}개</span>
      </h3>
      <fieldset disabled={busy} className="flex gap-5 text-xs">
        <legend className="sr-only">{lot.itemName} 판매 상태</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`sale-${lot.id}`}
            checked={!sold}
            onChange={() => setSold(false)}
          />
          미판매
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`sale-${lot.id}`}
            checked={sold}
            onChange={() => setSold(true)}
          />
          판매완료
        </label>
      </fieldset>
      {sold && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs">
              개당 가격 (메소)
              <input
                inputMode="numeric"
                disabled={busy}
                value={unitPrice}
                onChange={(event) => {
                  const price = event.target.value
                  setUnitPrice(price)
                  const total = parseDigits(price) * lot.quantity
                  setAmount(Number.isSafeInteger(total) && total >= 0 ? String(total) : '')
                }}
                className={field}
              />
            </label>
            <MesoAmountHint value={unitPrice} />
          </div>
          <div>
            <label className="block text-xs">
              총 가격 (수수료 차감 전 메소)
              <input
                inputMode="numeric"
                required
                disabled={busy}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setUnitPrice('')
                }}
                className={field}
              />
            </label>
            <MesoAmountHint value={amount} />
          </div>
          <HuntingSaleFeeField
            rate={feeRate}
            grossAmount={parseDigits(amount)}
            busy={busy}
            onChange={(rate) => {
              setFeeRate(rate)
              rememberHuntingSaleFee(rate)
            }}
          />
          <p className="text-[11px] leading-5 text-muted sm:col-span-2">
            획득 수량 전체를 판매완료로 기록합니다. 개당 가격 또는 총 가격은 수수료 차감 전 판매
            금액을 입력하세요. 선택한 수수료를 뺀 금액이 수익에 반영됩니다.
          </p>
          {sales.some((sale) => sale.feeAmount === 0 && sale.grossAmount > 0) && (
            <p className="text-[11px] leading-5 text-muted sm:col-span-2">
              기존 판매에 수수료 미적용 기록이 있습니다. 저장하면 선택한 비율로 재계산하므로, 입력한
              총 가격이 수수료 차감 전 금액인지 확인해 주세요.
            </p>
          )}
        </div>
      )}
      {sales.length > 0 && (
        <p className="text-[11px] leading-5 text-muted">
          저장된 판매: {formatMeso(lot.soldQuantity)}개 · {formatMeso(lot.saleIncome)} 메소
          {lot.remaining > 0 || sales.length > 1
            ? ' · 저장하면 선택한 상태로 기존 판매 기록을 정리합니다.'
            : ''}
          {!sold ? ' · 미판매로 저장하면 해당 판매 수익이 취소됩니다.' : ''}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  )
}
