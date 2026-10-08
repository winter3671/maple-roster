import { useId, useState, type FormEvent } from 'react'
import {
  parseBossDetails,
  parseCrystal,
  type BossRun,
  type BossRunUpdate,
  type CrystalInput
} from '../../../shared/contracts/boss.contract'
import { getKstDate } from '../../../shared/dates'
import { readText } from '../../../shared/validation'
import { formatMeso, parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { BossDetailsFields, bossFieldClass } from './BossPresetForm'

export function BossRunForm({
  run,
  busy,
  onSave,
  onCancel
}: {
  run: BossRun
  busy: boolean
  onSave: (input: BossRunUpdate) => Promise<boolean>
  onCancel: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState({
    difficulty: run.difficulty,
    partySize: String(run.partySize),
    crystalPrice: String(run.crystalPrice),
    notes: run.notes
  })
  const [error, setError] = useState('')
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave({
        id: run.id,
        ...parseBossDetails({
          ...draft,
          partySize: parseDigits(draft.partySize),
          crystalPrice: parseDigits(draft.crystalPrice)
        }),
        notes: readText(draft.notes, '메모', 500, false, true)
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm font-semibold">
        {run.characterName} · {run.bossName}
      </p>
      <p className="text-xs leading-5 text-muted">
        이 주차의 기록만 수정합니다. 프리셋과 다른 주차에는 반영하지 않습니다.
      </p>
      <BossDetailsFields id={id} draft={draft} busy={busy} change={change} />
      <div>
        <label htmlFor={`${id}-notes`} className="text-xs font-semibold">
          보스 기록 메모
        </label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          value={draft.notes}
          onChange={(event) => change('notes', event.target.value)}
          maxLength={500}
          disabled={busy}
          className={bossFieldClass}
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
        <Button type="submit" disabled={busy}>
          보스 기록 수정 저장
        </Button>
      </div>
    </form>
  )
}
export function CrystalSaleForm({
  run,
  busy,
  onSave,
  onCancel
}: {
  run: BossRun
  busy: boolean
  onSave: (input: CrystalInput) => Promise<boolean>
  onCancel: () => void
}) {
  const id = useId()
  const [date, setDate] = useState(run.settlement?.date ?? getKstDate())
  const [amount, setAmount] = useState(String(run.settlement?.amount ?? run.expectedShare))
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave(parseCrystal({ runId: run.id, date, amount: parseDigits(amount) }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm font-semibold">
        {run.characterName} · {run.bossName} ({run.difficulty})
      </p>
      <p className="text-xs leading-5 text-muted">
        프리셋 기준 예상 내 몫 {formatMeso(run.expectedShare)} 메소 · {run.partySize}인 파티
      </p>
      <div>
        <label htmlFor={`${id}-date`} className="text-xs font-semibold">
          결정석 판매일
        </label>
        <input
          id={`${id}-date`}
          type="date"
          min={run.week}
          max={getKstDate()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          disabled={busy}
          className={bossFieldClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-amount`} className="text-xs font-semibold">
          실제 수령액 (메소)
        </label>
        <input
          id={`${id}-amount`}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={() => {
            const value = parseDigits(amount)
            if (Number.isSafeInteger(value)) setAmount(formatMeso(value))
          }}
          required
          disabled={busy}
          className={bossFieldClass}
        />
      </div>
      <p className="text-xs leading-5 text-muted">
        내가 실제로 받은 메소를 입력하세요. 입력한 판매일의 수입으로 집계합니다. 0 메소는 판매
        기록만 남깁니다.
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
          {busy ? '저장 중…' : run.settlement ? '판매 수정 저장' : '판매 확정'}
        </Button>
      </div>
    </form>
  )
}
