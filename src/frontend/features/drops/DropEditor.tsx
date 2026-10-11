import { useState, type FormEvent } from 'react'
import type { DropLot, DropSale } from '../../../shared/contracts/drop.contract'
import { getKstDate } from '../../../shared/dates'
import { Button } from '../../components/ui/Button'
import { formatMeso, parseDigits } from '../../lib/format'
import { FragmentSaleForm } from './FragmentSaleForm'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { auctionFee } from '../../../shared/auction-fee'
import { useFormProtection } from '../../components/InputProtection'

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
    feeRate: sale
      ? sale.feeAmount === 0
        ? '0'
        : ([3, 5]
            .find((rate) => auctionFee(sale.grossAmount, rate as 3 | 5) === sale.feeAmount)
            ?.toString() ?? 'legacy')
      : '3',
    partySize: String(sale?.partySize ?? lot?.partySize ?? 1),
    shareMode:
      sale && sale.feeAmount === 0 && sale.partySize === 1 && sale.shareMode === 'equal'
        ? 'received'
        : (sale?.shareMode ?? 'equal'),
    manualShare: String(sale?.manualShare ?? 0)
  })
  const [error, setError] = useState('')
  const protection = useFormProtection(draft, busy && !simpleFragment)
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
      await protection.save(() =>
        onSave({
          ...draft,
          quantity: parseDigits(draft.quantity),
          estimatedUnitPrice: parseDigits(draft.estimatedUnitPrice),
          grossAmount: parseDigits(draft.grossAmount),
          feeAmount: fee,
          ...(draft.feeRate === 'legacy' && draft.shareMode !== 'received'
            ? { feeRate: undefined }
            : { feeRate: draft.shareMode === 'received' ? 0 : Number(draft.feeRate) }),
          shareMode: draft.shareMode === 'received' ? 'equal' : draft.shareMode,
          partySize: draft.shareMode === 'received' ? 1 : parseDigits(draft.partySize),
          manualShare: parseDigits(draft.manualShare)
        })
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  const gross = parseDigits(draft.grossAmount),
    fee =
      draft.shareMode === 'received' || draft.feeRate === '0'
        ? 0
        : draft.feeRate === 'legacy'
          ? parseDigits(draft.feeAmount)
          : Number.isSafeInteger(gross) && gross >= 0
            ? auctionFee(gross, Number(draft.feeRate) as 3 | 5)
            : NaN,
    party = parseDigits(draft.partySize)
  const preview =
    Number.isSafeInteger(gross) &&
    Number.isSafeInteger(fee) &&
    gross >= fee &&
    (draft.shareMode === 'received' || (Number.isInteger(party) && party >= 1 && party <= 6)) &&
    (draft.shareMode !== 'manual' ||
      (Number.isSafeInteger(parseDigits(draft.manualShare)) &&
        parseDigits(draft.manualShare) <= gross - fee))
      ? draft.shareMode === 'received'
        ? gross
        : draft.shareMode === 'manual'
          ? parseDigits(draft.manualShare)
          : Number((BigInt(gross) - BigInt(fee)) / BigInt(party))
      : null
  if (simpleFragment)
    return (
      <FragmentSaleForm lot={lot!} sale={sale} busy={busy} onCancel={onCancel} onSave={onSave} />
    )
  return (
    <form
      {...protection.formProps}
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
          <label className="block text-xs">
            기록 방식
            <select
              aria-label="기록 방식"
              className={field}
              disabled={busy}
              value={draft.shareMode}
              onChange={(event) => change('shareMode', event.target.value)}
            >
              <option value="received">분배받은 금액 기록 (수수료 없음)</option>
              <option value="equal">판매 후 균등 분배</option>
              <option value="manual">판매 후 내 분배금 직접 입력</option>
            </select>
          </label>
          {input(
            draft.shareMode === 'received' ? '분배받은 금액 (메소)' : '전체 판매대금 (메소)',
            'grossAmount'
          )}
          <label className="block text-xs">
            판매 수수료
            <select
              aria-label="판매 수수료"
              className={field}
              disabled={busy || draft.shareMode === 'received'}
              value={draft.shareMode === 'received' ? '0' : draft.feeRate}
              onChange={(event) => change('feeRate', event.target.value)}
            >
              <option value="0">없음</option>
              <option value="3">3%</option>
              <option value="5">5%</option>
              {draft.feeRate === 'legacy' && (
                <option value="legacy">
                  기존 수수료 유지 ({formatMeso(sale?.feeAmount ?? 0)} 메소)
                </option>
              )}
            </select>
          </label>
          {draft.shareMode !== 'received' && input('분배 인원 (1~6)', 'partySize')}
          {draft.shareMode === 'manual' && input('내 실제 분배금 (메소)', 'manualShare')}
          <div className="rounded-lg bg-brand-soft p-3 text-xs leading-6">
            <p className="text-muted">
              수수료: {Number.isSafeInteger(fee) ? `${formatMeso(fee)} 메소` : '—'}
            </p>
            <p className="font-semibold text-brand">
              내 몫 미리보기{' '}
              {preview === null ? '입력값을 확인하세요' : `${formatMeso(preview)} 메소`}
            </p>
            {preview !== null && <MesoAmountHint value={preview} />}
          </div>
          <p className="text-[11px] leading-5 text-muted">
            {draft.shareMode === 'received'
              ? '이미 분배받은 금액을 그대로 수익에 반영합니다. 수수료를 차감하거나 다시 나누지 않습니다.'
              : '판매대금은 수수료 차감 전 전체 금액입니다. 선택한 수수료를 차감한 뒤 분배하며, 1메소 미만은 버립니다.'}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => protection.cancel(onCancel)}>
          돌아가기
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? '저장 중…' : `${prefix} 저장`}
        </Button>
      </div>
    </form>
  )
}
