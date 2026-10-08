import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import { parseHuntingInput, type HuntingInput } from '../../../shared/contracts/hunting.contract'
import { getKstDate } from '../../../shared/dates'
import { parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'

type Draft = { [Key in keyof HuntingInput]: string }
const fieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50'

interface Props {
  characters: Character[]
  initial?: HuntingInput
  busy: boolean
  onSave: (input: HuntingInput) => Promise<boolean>
  onCancel?: () => void
}

export function HuntingSessionForm({ characters, initial, busy, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(() => ({
    characterId: initial?.characterId ?? '',
    date: initial?.date ?? getKstDate(),
    minutes: String(initial?.minutes ?? 30),
    mesos: String(initial?.mesos ?? 0),
    cost: String(initial?.cost ?? 0),
    solFragments: String(initial?.solFragments ?? 0),
    nodestones: String(initial?.nodestones ?? 0),
    notes: initial?.notes ?? ''
  }))
  const [error, setError] = useState<string | null>(null)
  const [recordNodestones, setRecordNodestones] = useState((initial?.nodestones ?? 0) > 0)
  const id = useId()
  const options = characters.filter(
    (character) => !character.isHidden || character.id === initial?.characterId
  )
  useEffect(() => {
    if (!initial)
      setDraft((current) =>
        characters.some((character) => !character.isHidden && character.id === current.characterId)
          ? current
          : {
              ...current,
              characterId: characters.find((character) => !character.isHidden)?.id ?? ''
            }
      )
  }, [characters, initial])

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const input = parseHuntingInput({
        ...draft,
        minutes: parseDigits(draft.minutes),
        mesos: parseDigits(draft.mesos),
        cost: parseDigits(draft.cost),
        solFragments: parseDigits(draft.solFragments),
        nodestones: recordNodestones ? parseDigits(draft.nodestones) : 0
      })
      if ((await onSave(input)) && !initial)
        setDraft((current) => ({
          ...current,
          mesos: '0',
          cost: '0',
          solFragments: '0',
          nodestones: '0',
          notes: ''
        }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div>
        <label htmlFor={`${id}-character`} className="text-xs font-semibold">
          사냥 캐릭터
        </label>
        <select
          id={`${id}-character`}
          value={draft.characterId}
          onChange={(event) => change('characterId', event.target.value)}
          required
          disabled={busy || options.length === 0}
          className={fieldClass}
        >
          <option value="" disabled>
            캐릭터 선택
          </option>
          {options.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name} · {character.world}
              {character.isHidden ? ' (숨김)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-date`} className="text-xs font-semibold">
            사냥 날짜
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
          <label htmlFor={`${id}-minutes`} className="text-xs font-semibold">
            사냥 시간 (분)
          </label>
          <input
            id={`${id}-minutes`}
            type="number"
            min={0}
            max={1440}
            step={1}
            value={draft.minutes}
            onChange={(event) => change('minutes', event.target.value)}
            required
            disabled={busy}
            className={fieldClass}
          />
        </div>
      </div>
      <p className="text-[11px] leading-5 text-muted">
        시간을 모르면 0분으로 기록하세요. 시간당 수익 계산에서 제외됩니다.
      </p>
      <div>
        <label htmlFor={`${id}-mesos`} className="text-xs font-semibold">
          획득 메소
        </label>
        <input
          id={`${id}-mesos`}
          inputMode="numeric"
          value={draft.mesos}
          onChange={(event) => change('mesos', event.target.value)}
          onBlur={() => {
            const value = parseDigits(draft.mesos)
            if (Number.isSafeInteger(value)) change('mesos', value.toLocaleString('ko-KR'))
          }}
          required
          disabled={busy}
          className={fieldClass}
        />
        <p className="mt-1 text-[11px] text-muted">사냥으로 직접 얻은 메소만 입력하세요.</p>
      </div>
      {initial && initial.cost > 0 && (
        <p className="text-[11px] leading-5 text-muted">
          이전 기록의 소모 비용은 기존 장부와 함께 유지됩니다.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label htmlFor={`${id}-fragments`} className="text-xs font-semibold">
            솔 에르다 조각 (개)
          </label>
          <input
            id={`${id}-fragments`}
            type="number"
            min={0}
            max={1000000}
            step={1}
            value={draft.solFragments}
            onChange={(event) => change('solFragments', event.target.value)}
            required
            disabled={busy}
            className={fieldClass}
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={recordNodestones}
            disabled={busy}
            onChange={(event) => setRecordNodestones(event.target.checked)}
          />
          추가 기록: 코어 젬스톤
        </label>
        {recordNodestones && (
          <div>
            <label htmlFor={`${id}-nodestones`} className="text-xs font-semibold">
              코어 젬스톤 (개)
            </label>
            <input
              id={`${id}-nodestones`}
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={draft.nodestones}
              onChange={(event) => change('nodestones', event.target.value)}
              required
              disabled={busy}
              className={fieldClass}
            />
          </div>
        )}
      </div>
      <p className="text-[11px] leading-5 text-muted">
        획득 수량을 입력한 뒤 회차의 드랍 관리에서 판매를 기록하세요. 판매된 수량보다 획득 수량을
        줄일 수 없습니다.
      </p>
      <div>
        <label htmlFor={`${id}-notes`} className="text-xs font-semibold">
          회차 메모
        </label>
        <textarea
          id={`${id}-notes`}
          rows={2}
          maxLength={500}
          value={draft.notes}
          onChange={(event) => change('notes', event.target.value)}
          disabled={busy}
          placeholder="사냥터, 재획 회차 등"
          className={`${fieldClass} resize-y`}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs leading-5 text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            취소
          </Button>
        )}
        <Button type="submit" disabled={busy || options.length === 0}>
          {busy ? '저장 중…' : initial ? '수정 저장' : '사냥 기록 저장'}
        </Button>
      </div>
    </form>
  )
}
