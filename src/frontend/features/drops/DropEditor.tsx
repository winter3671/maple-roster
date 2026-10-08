import { useState, type FormEvent } from 'react'
import type { DropLot, DropSale } from '../../../shared/contracts/drop.contract'
import { getKstDate } from '../../../shared/dates'
import { Button } from '../../components/ui/Button'
import { formatMeso, parseDigits } from '../../lib/format'
import { FragmentSaleForm } from './FragmentSaleForm'
import { MesoAmountHint } from '../../components/MesoAmountHint'

const field =
  'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50'
export type Editor =
  { kind: 'lot'; lot?: DropLot } | { kind: 'sale'; lot: DropLot; sale?: DropSale }

export function DropEditor({
  editor,
  busy,
  onCancel,
  onSave
}: {
  editor: Editor
  busy: boolean
  onCancel: () => void
  onSave: (raw: Record<string, unknown>) => Promise<boolean>
}) {
  const lot = editor.lot
  const sale = editor.kind === 'sale' ? editor.sale : undefined
  const simpleFragment =
    editor.kind === 'sale' &&
    lot?.managedKind === 'sol_fragment' &&
    (!sale || (sale.feeAmount === 0 && sale.partySize === 1 && sale.shareMode === 'equal'))
  const [draft, setDraft] = useState<Record<string, string>>({
    itemName: lot?.itemName ?? '',
    quantity: String(
      sale?.quantity ?? (editor.kind === 'sale' ? lot!.remaining : (lot?.quantity ?? 1))
    ),
    estimatedUnitPrice: String(lot?.estimatedUnitPrice ?? 0),
    notes: lot?.notes ?? '',
    date: sale?.date ?? getKstDate(),
    grossAmount: String(sale?.grossAmount ?? 0),
    feeAmount: String(sale?.feeAmount ?? 0),
    partySize: String(sale?.partySize ?? lot?.partySize ?? 1),
    shareMode: sale?.shareMode ?? 'equal',
    manualShare: String(sale?.manualShare ?? 0)
  })
  const [error, setError] = useState('')
  const prefix = editor.kind === 'sale' ? '판매' : '획득'
  function change(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  function input(label: string, key: string, numeric = true, disabled = false) {
    return (
      <label className="block text-xs">
        {label}
        <input
          aria-label={label}
          className={field}
          value={draft[key]}
          disabled={busy || disabled}
          required
          inputMode={numeric ? 'numeric' : 'text'}
          maxLength={numeric ? 25 : 80}
          onChange={(event) => change(key, event.target.value)}
        />
        {['estimatedUnitPrice', 'grossAmount', 'feeAmount', 'manualShare'].includes(key) && (
          <MesoAmountHint value={draft[key]} />
        )}
      </label>
    )
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave({
        ...draft,
        quantity: parseDigits(draft.quantity),
        estimatedUnitPrice: parseDigits(draft.estimatedUnitPrice),
        grossAmount: parseDigits(draft.grossAmount),
        feeAmount: parseDigits(draft.feeAmount),
        partySize: parseDigits(draft.partySize),
        manualShare: parseDigits(draft.manualShare)
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  const gross = parseDigits(draft.grossAmount),
    fee = parseDigits(draft.feeAmount),
    party = parseDigits(draft.partySize)
  const preview =
    Number.isSafeInteger(gross) &&
    Number.isSafeInteger(fee) &&
    gross >= fee &&
    Number.isInteger(party) &&
    party >= 1 &&
    party <= 6
      ? Number((BigInt(gross) - BigInt(fee)) / BigInt(party))
      : null
  if (simpleFragment)
    return (
      <FragmentSaleForm lot={lot!} sale={sale} busy={busy} onCancel={onCancel} onSave={onSave} />
    )
  return (
    <form
      className="space-y-3 rounded-xl border border-brand/20 bg-brand-soft/20 p-4"
      onSubmit={(event) => void submit(event)}
    >
      <h3 className="text-sm font-semibold">
        {prefix} {lot ? lot.itemName : '아이템 추가'}
        {sale ? ' 수정' : ''}
      </h3>
      {editor.kind === 'lot' ? (
        <>
          {input('아이템 이름', 'itemName', false, !!lot)}
          {input('획득 수량', 'quantity', true, !!lot?.managedKind)}
          {lot?.managedKind && (
            <p className="text-[11px] text-muted">획득 수량은 사냥 회차에서 수정하세요.</p>
          )}
          {input('예상 단가 (메소)', 'estimatedUnitPrice')}
          <label className="block text-xs">
            아이템 메모
            <textarea
              aria-label="아이템 메모"
              className={field}
              disabled={busy}
              maxLength={500}
              value={draft.notes}
              onChange={(event) => change('notes', event.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          {lot?.managedKind === 'sol_fragment' && (
            <p className="text-[11px] leading-5 text-muted">
              이전 판매의 수수료·분배 설정과 수익을 보존하기 위해 이 기록은 기존 수정 화면을
              사용합니다. 새 조각 판매는 단가와 총액으로 기록합니다.
            </p>
          )}
          <label className="block text-xs">
            판매 날짜
            <input
              aria-label="판매 날짜"
              type="date"
              className={field}
              min={lot!.acquiredDate}
              max={getKstDate()}
              required
              disabled={busy}
              value={draft.date}
              onChange={(event) => change('date', event.target.value)}
            />
          </label>
          {input('판매 수량', 'quantity')}
          <p className="text-[11px] text-muted">
            이번 판매 최대 {formatMeso(lot!.remaining + (sale?.quantity ?? 0))}개
          </p>
          {input('전체 판매대금 (메소)', 'grossAmount')}
          {input('전체 수수료 (메소)', 'feeAmount')}
          {input('분배 인원 (1~6)', 'partySize')}
          <label className="block text-xs">
            분배 방식
            <select
              aria-label="분배 방식"
              className={field}
              disabled={busy}
              value={draft.shareMode}
              onChange={(event) => change('shareMode', event.target.value)}
            >
              <option value="equal">수수료 차감 후 균등 분배</option>
              <option value="manual">내 실제 분배금 직접 입력</option>
            </select>
          </label>
          {draft.shareMode === 'manual' ? (
            input('내 실제 분배금 (메소)', 'manualShare')
          ) : (
            <p className="text-xs text-brand">
              내 몫 미리보기{' '}
              {preview === null ? '입력값을 확인하세요' : `${formatMeso(preview)} 메소`} · 1메소
              미만 버림
            </p>
          )}
          <p className="text-[11px] leading-5 text-muted">
            대금·수수료는 선택한 수량 전체 금액입니다. 실제 수수료를 직접 입력하세요.
          </p>
        </>
      )}
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
          {busy ? '저장 중…' : `${prefix} 저장`}
        </Button>
      </div>
    </form>
  )
}
