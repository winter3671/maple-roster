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
  const [amount, setAmount] = useState(String(lot.saleIncome || ''))
  const [unitPrice, setUnitPrice] = useState(
    lot.saleIncome && lot.saleIncome % lot.quantity === 0
      ? String(lot.saleIncome / lot.quantity)
      : ''
  )
  const [error, setError] = useState('')
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
    await onSave({ lotId: lot.id, sold, date, grossAmount, requestId })
  }
  return (
    <form
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
              총 가격 (메소)
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
          <p className="text-[11px] leading-5 text-muted sm:col-span-2">
            획득 수량 전체를 판매완료로 기록합니다. 개당 가격을 입력하면 총 가격이 계산되며, 실제
            받은 금액으로 총 가격을 수정할 수 있습니다.
          </p>
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
