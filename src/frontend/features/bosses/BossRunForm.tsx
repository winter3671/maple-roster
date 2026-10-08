import { useId, useState, type FormEvent } from 'react'
import {
  parseBossDetails,
  type BossRun,
  type BossRunUpdate
} from '../../../shared/contracts/boss.contract'
import { getKstDate } from '../../../shared/dates'
import { clampBossParty } from '../../../shared/boss-catalog'
import { readText } from '../../../shared/validation'
import { parseDigits } from '../../lib/format'
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
    notes: run.notes,
    incomeDate: run.settlement?.date ?? run.week
  })
  const [error, setError] = useState('')
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((current) =>
      key === 'difficulty'
        ? {
            ...current,
            difficulty: value,
            partySize: clampBossParty(run.bossName, value, current.partySize)
          }
        : { ...current, [key]: value }
    )
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave({
        id: run.id,
        ...parseBossDetails({
          ...draft,
          partySize: parseDigits(draft.partySize)
        }),
        notes: readText(draft.notes, '메모', 500, false, true),
        ...(run.isCleared ? { incomeDate: draft.incomeDate } : {})
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
      <BossDetailsFields
        id={id}
        draft={draft}
        bossName={run.bossName}
        legacyDifficulty={run.difficulty}
        legacyPartySize={run.partySize}
        preserveStoredPrice
        priceDate={run.week}
        storedPrice={run.crystalPrice}
        busy={busy}
        change={change}
      />
      <div>
        {run.isCleared && (
          <label className="mb-4 block text-xs font-semibold">
            수익 반영일
            <input
              aria-label="수익 반영일"
              type="date"
              value={draft.incomeDate}
              min={run.week}
              max={getKstDate()}
              required
              disabled={busy}
              className={bossFieldClass}
              onChange={(event) => change('incomeDate', event.target.value)}
            />
          </label>
        )}
        {run.isCleared && (
          <p className="mb-4 text-xs leading-5 text-muted">
            난이도·인원을 수정하면 결정석 수익도 자동 갱신됩니다.
          </p>
        )}
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
