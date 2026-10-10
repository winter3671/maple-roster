import { useId, useRef, useState, type FormEvent } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type { LedgerEntry } from '../../../shared/contracts/ledger.contract'
import {
  INCOME_CATEGORIES,
  parseIncomeInput,
  type IncomeInput
} from '../../../shared/contracts/income.contract'
import { getKstDate } from '../../../shared/dates'
import { parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { MesoAmountHint } from '../../components/MesoAmountHint'

const field =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50'
export function IncomeForm({
  characters,
  initial,
  preferredCharacterId,
  busy,
  onSave,
  onCancel
}: {
  characters: Character[]
  initial?: LedgerEntry
  preferredCharacterId?: string
  busy: boolean
  onSave: (input: IncomeInput, requestId: string) => Promise<boolean>
  onCancel: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => ({
    characterId:
      initial?.characterId ??
      characters.find((row) => row.id === preferredCharacterId)?.id ??
      characters[0]?.id ??
      '',
    date: initial?.date ?? getKstDate(),
    category: initial?.incomeCategory ?? '기타',
    amount: initial ? String(initial.amount) : '',
    notes: initial?.notes ?? ''
  }))
  const [error, setError] = useState('')
  const retry = useRef({ fingerprint: '', id: '' })
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    try {
      const input = parseIncomeInput({ ...draft, amount: parseDigits(draft.amount) }, getKstDate())
      const fingerprint = JSON.stringify(input)
      if (retry.current.fingerprint !== fingerprint)
        retry.current = { fingerprint, id: crypto.randomUUID() }
      await onSave(input, retry.current.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <section
      aria-label={initial ? '수익 수정' : '수익 추가'}
      className="rounded-xl border border-line bg-canvas p-5"
    >
      <h3 className="mb-4 text-sm font-semibold">{initial ? '수익 수정' : '수익 추가'}</h3>
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-character`} className="text-xs font-semibold">
              수익 캐릭터
            </label>
            <select
              id={`${id}-character`}
              className={field}
              value={draft.characterId}
              onChange={(event) => change('characterId', event.target.value)}
              disabled={busy}
              required
            >
              <option value="" disabled>
                캐릭터 선택
              </option>
              {characters.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.world}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-date`} className="text-xs font-semibold">
              수익 날짜
            </label>
            <input
              id={`${id}-date`}
              type="date"
              max={getKstDate()}
              className={field}
              value={draft.date}
              onChange={(event) => change('date', event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div>
            <label htmlFor={`${id}-category`} className="text-xs font-semibold">
              수익 분류
            </label>
            <select
              id={`${id}-category`}
              className={field}
              value={draft.category}
              onChange={(event) => change('category', event.target.value)}
              disabled={busy}
            >
              {INCOME_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-amount`} className="text-xs font-semibold">
              수익 금액 (메소)
            </label>
            <input
              id={`${id}-amount`}
              className={field}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.amount}
              onChange={(event) => change('amount', event.target.value)}
              disabled={busy}
              required
            />
            <MesoAmountHint value={draft.amount} />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-notes`} className="text-xs font-semibold">
            메모
          </label>
          <textarea
            id={`${id}-notes`}
            className={field}
            rows={2}
            maxLength={500}
            placeholder="수익을 얻은 방법이나 판매한 아이템 등"
            value={draft.notes}
            onChange={(event) => change('notes', event.target.value)}
            disabled={busy}
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-expense">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy || !characters.length} type="submit">
            {busy ? '저장 중…' : '수익 저장'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            취소
          </Button>
        </div>
      </form>
    </section>
  )
}
