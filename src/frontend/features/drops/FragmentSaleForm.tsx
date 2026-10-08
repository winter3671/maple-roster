import { useState, type FormEvent } from 'react'
import type { DropLot, DropSale } from '../../../shared/contracts/drop.contract'
import { getKstDate } from '../../../shared/dates'
import { formatMeso, parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'

export function FragmentSaleForm({
  lot,
  sale,
  busy,
  onCancel,
  onSave
}: {
  lot: DropLot
  sale?: DropSale
  busy: boolean
  onCancel: () => void
  onSave: (raw: Record<string, unknown>) => Promise<boolean>
}) {
  const [date, setDate] = useState(sale?.date ?? getKstDate())
  const [quantity, setQuantity] = useState(String(sale?.quantity ?? lot.remaining))
  const [unitPrice, setUnitPrice] = useState(
    sale && sale.grossAmount % sale.quantity === 0 ? String(sale.grossAmount / sale.quantity) : ''
  )
  const [amount, setAmount] = useState(String(sale?.grossAmount ?? 0))
  const [error, setError] = useState('')
  function calculate(nextQuantity: string, nextPrice: string) {
    const total = parseDigits(nextQuantity) * parseDigits(nextPrice)
    setAmount(Number.isSafeInteger(total) && total >= 0 ? String(total) : '')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave({
        date,
        quantity: parseDigits(quantity),
        grossAmount: parseDigits(amount),
        feeAmount: 0,
        partySize: 1,
        shareMode: 'equal',
        manualShare: null
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  const field =
    'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50'
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-xl border border-brand/20 bg-brand-soft/20 p-4"
    >
      <h3 className="text-sm font-semibold">솔 에르다 조각 판매{sale ? ' 수정' : ''}</h3>
      <label className="block text-xs">
        판매 날짜
        <input
          aria-label="판매 날짜"
          type="date"
          required
          disabled={busy}
          min={lot.acquiredDate}
          max={getKstDate()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={field}
        />
      </label>
      <label className="block text-xs">
        판매 수량
        <input
          aria-label="판매 수량"
          type="number"
          required
          disabled={busy}
          min={1}
          max={lot.remaining + (sale?.quantity ?? 0)}
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value)
            if (unitPrice) calculate(event.target.value, unitPrice)
          }}
          className={field}
        />
      </label>
      <p className="text-[11px] text-muted">
        이번 판매 최대 {formatMeso(lot.remaining + (sale?.quantity ?? 0))}개
      </p>
      <label className="block text-xs">
        개당 판매 금액 (메소)
        <input
          aria-label="개당 판매 금액 (메소)"
          inputMode="numeric"
          disabled={busy}
          value={unitPrice}
          onChange={(event) => {
            setUnitPrice(event.target.value)
            calculate(quantity, event.target.value)
          }}
          className={field}
        />
      </label>
      <label className="block text-xs">
        총 판매 금액 (메소)
        <input
          aria-label="총 판매 금액 (메소)"
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
      <p className="text-[11px] leading-5 text-muted">
        개당 금액과 수량으로 합계를 계산합니다. 수수료가 있었다면 총 판매 금액을 실제 받은 금액으로
        조정하세요. 이 금액 전체가 수익으로 반영됩니다.
      </p>
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          돌아가기
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? '저장 중…' : '판매 저장'}
        </Button>
      </div>
    </form>
  )
}
