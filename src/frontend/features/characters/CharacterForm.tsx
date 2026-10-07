import { useId, useState, type FormEvent } from 'react'
import {
  parseCharacterInput,
  type CharacterInput
} from '../../../shared/contracts/character.contract'
import { Button } from '../../components/ui/Button'

const inputClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50'
const emptyInput: CharacterInput = { name: '', world: '', notes: '' }

interface CharacterFormProps {
  initial?: CharacterInput
  busy: boolean
  onSave: (input: CharacterInput) => Promise<boolean>
  onCancel?: () => void
}

export function CharacterForm({ initial, busy, onSave, onCancel }: CharacterFormProps) {
  const [input, setInput] = useState<CharacterInput>(initial ?? emptyInput)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const value = parseCharacterInput(input)
      if ((await onSave(value)) && !initial) setInput(emptyInput)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div>
        <label htmlFor={`${id}-name`} className="text-xs font-semibold">
          캐릭터 이름 <span className="text-brand">*</span>
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={40}
          value={input.name}
          disabled={busy}
          autoComplete="off"
          onChange={(event) => setInput({ ...input, name: event.target.value })}
          placeholder="캐릭터 이름"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-world`} className="text-xs font-semibold">
          월드 <span className="text-brand">*</span>
        </label>
        <input
          id={`${id}-world`}
          name="world"
          required
          maxLength={40}
          value={input.world}
          disabled={busy}
          autoComplete="off"
          onChange={(event) => setInput({ ...input, world: event.target.value })}
          placeholder="예: 스카니아"
          className={inputClass}
        />
        <p className="mt-2 text-[11px] leading-5 text-muted">
          게임에 표시된 월드 이름을 입력해 주세요.
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-notes`} className="text-xs font-semibold">
          메모 <span className="font-normal text-muted">선택</span>
        </label>
        <textarea
          id={`${id}-notes`}
          name="notes"
          maxLength={500}
          rows={3}
          value={input.notes}
          disabled={busy}
          onChange={(event) => setInput({ ...input, notes: event.target.value })}
          placeholder="본캐, 보스용 부캐 등"
          className={`${inputClass} resize-y`}
        />
        <p className="mt-1 text-right text-[10px] text-muted">{input.notes.length} / 500</p>
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
        <Button type="submit" disabled={busy}>
          {busy ? '저장 중…' : initial ? '수정 저장' : '캐릭터 등록'}
        </Button>
      </div>
    </form>
  )
}
