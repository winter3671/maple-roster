import { useId, useRef, useState, type FormEvent } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type { LedgerEntry } from '../../../shared/contracts/ledger.contract'
import {
  EXPENSE_CATEGORIES,
  parseExpenseInput,
  type ExpenseInput
} from '../../../shared/contracts/expense.contract'
import { getKstDate } from '../../../shared/dates'
import { parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { MesoAmountHint } from '../../components/MesoAmountHint'

const fieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50'
export function ExpenseForm({
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
  onSave: (input: ExpenseInput, requestId: string) => Promise<boolean>
  onCancel: () => void
}) {
  const options = characters.filter(
    (character) => !character.isHidden || character.id === initial?.characterId
  )
  const [draft, setDraft] = useState(() => ({
    characterId:
      initial?.characterId ??
      options.find((row) => row.id === preferredCharacterId)?.id ??
      options[0]?.id ??
      '',
    date: initial?.date ?? getKstDate(),
    category: initial?.expenseCategory ?? '기타',
    amount: initial ? String(initial.amount) : '',
    notes: initial?.notes ?? ''
  }))
  const [error, setError] = useState('')
  const retry = useRef({ fingerprint: '', id: '' })
  const id = useId()
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    try {
      const input = parseExpenseInput({ ...draft, amount: parseDigits(draft.amount) }, getKstDate())
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
      aria-label={initial ? '지출 수정' : '지출 추가'}
      className="rounded-2xl border border-line bg-surface p-6"
    >
      <h2 className="mb-4 text-sm font-semibold">{initial ? '지출 수정' : '지출 추가'}</h2>
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-character`} className="text-xs font-semibold">
              지출 캐릭터
            </label>
            <select
              autoFocus
              id={`${id}-character`}
              value={draft.characterId}
              onChange={(event) => change('characterId', event.target.value)}
              required
              disabled={busy}
              className={fieldClass}
            >
              <option value="" disabled>
                캐릭터 선택
              </option>
              {options.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.world}
                  {row.isHidden ? ' (숨김)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-date`} className="text-xs font-semibold">
              지출 날짜
            </label>
            <input
              id={`${id}-date`}
              type="date"
              min="2000-01-01"
              max={getKstDate()}
              value={draft.date}
              onChange={(event) => change('date', event.target.value)}
              required
              disabled={busy}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-category`} className="text-xs font-semibold">
              지출 분류
            </label>
            <select
              id={`${id}-category`}
              value={draft.category}
              onChange={(event) => change('category', event.target.value)}
              disabled={busy}
              className={fieldClass}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-amount`} className="text-xs font-semibold">
              지출 금액 (메소)
            </label>
            <input
              id={`${id}-amount`}
              inputMode="numeric"
              value={draft.amount}
              onChange={(event) => change('amount', event.target.value)}
              required
              disabled={busy}
              className={fieldClass}
            />
            <MesoAmountHint value={draft.amount} />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-notes`} className="text-xs font-semibold">
            지출 메모
          </label>
          <textarea
            id={`${id}-notes`}
            rows={2}
            maxLength={500}
            value={draft.notes}
            onChange={(event) => change('notes', event.target.value)}
            disabled={busy}
            placeholder="구매한 장비, 강화 내용 등"
            className={`${fieldClass} resize-y`}
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-expense">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={busy || options.length === 0}>
            {busy ? '저장 중…' : initial ? '수정 저장' : '지출 저장'}
          </Button>
        </div>
      </form>
    </section>
  )
}
