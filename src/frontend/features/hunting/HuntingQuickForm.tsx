import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import { parseHuntingInput, type HuntingInput } from '../../../shared/contracts/hunting.contract'
import { getKstDate } from '../../../shared/dates'
import { parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { MesoAmountHint } from '../../components/MesoAmountHint'

const characterPreference = 'maple-roster:hunting-quick-character'
const fieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50'

function lastCharacter(): string {
  try {
    return localStorage.getItem(characterPreference) ?? ''
  } catch {
    return ''
  }
}

export function HuntingQuickForm({
  characters,
  busy,
  onSave
}: {
  characters: Character[]
  busy: boolean
  onSave: (input: HuntingInput) => Promise<boolean>
}) {
  const [characterId, setCharacterId] = useState(lastCharacter)
  const [mesos, setMesos] = useState('')
  const [fragments, setFragments] = useState('')
  const [error, setError] = useState('')
  const [focusAfterSave, setFocusAfterSave] = useState(false)
  const pending = useRef(false)
  const mesosField = useRef<HTMLInputElement>(null)
  const id = useId()
  const options = characters

  useEffect(() => {
    if (!characters.length) return
    setCharacterId((current) =>
      characters.some((character) => character.id === current) ? current : (characters[0]?.id ?? '')
    )
  }, [characters])

  useEffect(() => {
    if (focusAfterSave && !busy) {
      mesosField.current?.focus()
      setFocusAfterSave(false)
    }
  }, [focusAfterSave, busy])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || pending.current) return
    pending.current = true
    setError('')
    try {
      const input = parseHuntingInput({
        characterId,
        date: getKstDate(),
        minutes: 30,
        mesos: parseDigits(mesos),
        solFragments: parseDigits(fragments),
        cost: 0,
        nodestones: 0,
        notes: ''
      })
      if (await onSave(input)) {
        try {
          localStorage.setItem(characterPreference, characterId)
        } catch {
          /* Recording works even when preferences cannot be stored. */
        }
        setMesos('')
        setFragments('')
        setFocusAfterSave(true)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    } finally {
      pending.current = false
    }
  }

  return (
    <form
      aria-label="30분 사냥 빠른 기록"
      onSubmit={(event) => void submit(event)}
      className="space-y-4"
    >
      <div>
        <label htmlFor={`${id}-character`} className="text-xs font-semibold">
          사냥 캐릭터
        </label>
        <select
          id={`${id}-character`}
          value={characterId}
          onChange={(event) => setCharacterId(event.target.value)}
          required
          disabled={busy || !options.length}
          className={fieldClass}
        >
          <option value="" disabled>
            캐릭터 선택
          </option>
          {options.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name} · {character.world}
            </option>
          ))}
        </select>
      </div>
      <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
        오늘 · 30분 사냥
      </p>
      <div>
        <label htmlFor={`${id}-mesos`} className="text-xs font-semibold">
          획득 메소
        </label>
        <input
          ref={mesosField}
          id={`${id}-mesos`}
          inputMode="numeric"
          value={mesos}
          onChange={(event) => setMesos(event.target.value)}
          required
          disabled={busy || !options.length}
          placeholder="직접 획득한 메소"
          className={fieldClass}
        />
        <MesoAmountHint value={mesos} />
      </div>
      <div>
        <label htmlFor={`${id}-fragments`} className="text-xs font-semibold">
          솔 에르다 조각 (개)
        </label>
        <input
          id={`${id}-fragments`}
          inputMode="numeric"
          value={fragments}
          onChange={(event) => setFragments(event.target.value)}
          required
          disabled={busy || !options.length}
          placeholder="획득 수량 (없으면 0)"
          className={fieldClass}
        />
      </div>
      <p className="text-[11px] leading-5 text-muted">
        저장할 때 한국 시간 기준 오늘 날짜로 기록합니다. 조각은 획득 수량으로 보관하며, 판매 후
        수익에 반영됩니다. 다른 날짜·시간이나 추가 기록은 상세 기록을 이용하세요.
      </p>
      {error && (
        <p role="alert" className="text-xs leading-5 text-expense">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || !options.length}>
        {busy ? '저장 중…' : '30분 기록 저장'}
      </Button>
    </form>
  )
}
