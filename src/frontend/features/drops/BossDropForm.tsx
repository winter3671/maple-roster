import { useRef, useState, type FormEvent } from 'react'
import { bossDropChoices } from '../../../shared/boss-drop-catalog'
import { parseDropLot, type BossDropBatchCreate } from '../../../shared/contracts/drop.contract'
import { AppError } from '../../../shared/errors'
import { Button } from '../../components/ui/Button'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { parseDigits } from '../../lib/format'

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50'
const newRow = () => ({
  key: crypto.randomUUID(),
  choice: '',
  itemName: '',
  quantity: '1',
  estimatedUnitPrice: '0',
  notes: ''
})
type Row = ReturnType<typeof newRow>
export function BossDropForm({
  boss,
  source,
  busy,
  onSave,
  onCancel
}: {
  boss: { name: string; difficulty: string }
  source: BossDropBatchCreate['source']
  busy: boolean
  onSave: (input: BossDropBatchCreate) => Promise<boolean>
  onCancel: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() => [newRow()])
  const [details, setDetails] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const retry = useRef<{ fingerprint: string; ids: string[] } | null>(null)
  const choices = bossDropChoices(boss.name)
  function change(key: string, field: keyof Row, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || pending.current) return
    pending.current = true
    setError('')
    try {
      const items = rows.map((row) => {
        const { source: _source, ...item } = parseDropLot({
          source,
          itemName: row.choice === 'custom' ? row.itemName : row.choice,
          quantity: parseDigits(row.quantity),
          estimatedUnitPrice: parseDigits(row.estimatedUnitPrice),
          notes: row.notes
        })
        return item
      })
      if (new Set(items.map((item) => item.itemName)).size !== items.length)
        throw new AppError('VALIDATION_ERROR', '같은 아이템은 한 줄에서 수량을 늘려 기록해 주세요.')
      const fingerprint = JSON.stringify({ source, items })
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, ids: items.map(() => crypto.randomUUID()) }
      await onSave({
        source,
        items: items.map((item, index) => ({ ...item, requestId: retry.current!.ids[index] }))
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '획득 아이템을 확인해 주세요.')
    } finally {
      pending.current = false
    }
  }
  return (
    <form
      aria-label="보스 드랍 일괄 기록"
      onSubmit={(event) => void submit(event)}
      className="space-y-4 rounded-xl border border-brand/20 bg-brand-soft/20 p-4"
    >
      <h3 className="text-sm font-semibold">
        {boss.name} · {boss.difficulty} 드랍 기록
      </h3>
      <p className="text-[11px] leading-5 text-muted">
        실제 획득한 아이템을 선택하세요. 목록은 보스별 주요 보상이며 난이도별 전체 드랍표는
        아닙니다. 상자 보상은 개봉 후 나온 아이템을 기록하세요.
      </p>
      {rows.map((row, index) => (
        <fieldset
          key={row.key}
          disabled={busy}
          className="space-y-3 rounded-lg border border-line bg-surface p-3"
        >
          <legend className="px-1 text-xs font-semibold">아이템 {index + 1}</legend>
          <label className="block text-xs">
            획득 아이템
            <select
              aria-label={`아이템 ${index + 1} 선택`}
              value={row.choice}
              required
              className={field}
              onChange={(event) => change(row.key, 'choice', event.target.value)}
            >
              <option value="" disabled>
                아이템 선택
              </option>
              {choices.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                  {item.openedFrom ? ' (칠흑 상자 개봉 결과)' : ''}
                </option>
              ))}
              <option value="custom">기타 · 직접 입력</option>
            </select>
          </label>
          {row.choice === 'custom' && (
            <label className="block text-xs">
              아이템 이름
              <input
                aria-label={`아이템 ${index + 1} 이름`}
                value={row.itemName}
                maxLength={80}
                required
                className={field}
                onChange={(event) => change(row.key, 'itemName', event.target.value)}
              />
            </label>
          )}
          <label className="block text-xs">
            획득 수량
            <input
              aria-label={`아이템 ${index + 1} 수량`}
              inputMode="numeric"
              value={row.quantity}
              required
              className={field}
              onChange={(event) => change(row.key, 'quantity', event.target.value)}
            />
          </label>
          {details && (
            <>
              <label className="block text-xs">
                예상 단가 (메소)
                <input
                  aria-label={`아이템 ${index + 1} 예상 단가`}
                  inputMode="numeric"
                  value={row.estimatedUnitPrice}
                  required
                  className={field}
                  onChange={(event) => change(row.key, 'estimatedUnitPrice', event.target.value)}
                />
                <MesoAmountHint value={row.estimatedUnitPrice} />
              </label>
              <label className="block text-xs">
                메모
                <textarea
                  aria-label={`아이템 ${index + 1} 메모`}
                  rows={2}
                  maxLength={500}
                  value={row.notes}
                  className={field}
                  onChange={(event) => change(row.key, 'notes', event.target.value)}
                />
              </label>
            </>
          )}
          {rows.length > 1 && (
            <Button
              variant="secondary"
              aria-label={`아이템 ${index + 1} 제거`}
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
            >
              이 항목 제거
            </Button>
          )}
        </fieldset>
      ))}
      <Button
        variant="secondary"
        disabled={busy || rows.length >= 20}
        onClick={() => setRows((current) => [...current, newRow()])}
      >
        + 아이템 추가
      </Button>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={details}
          disabled={busy}
          onChange={(event) => setDetails(event.target.checked)}
        />
        예상 단가·메모 추가
      </label>
      <p className="text-[11px] leading-5 text-muted">
        같은 아이템이 여러 개면 수량을 늘리세요. 획득만 기록하면 수익은 늘지 않으며, 저장 후 판매
        기록에서 판매대금·수수료·분배 인원을 입력합니다.
      </p>
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? '저장 중…' : '드랍 일괄 저장'}
        </Button>
      </div>
    </form>
  )
}
