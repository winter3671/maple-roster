import { useEffect, useId, useState, type FormEvent } from 'react'
import type { BossPresetInput } from '../../../shared/contracts/boss.contract'
import { parseBossPreset } from '../../../shared/contracts/boss.contract'
import type { Character } from '../../../shared/contracts/character.contract'
import { parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'

export const bossFieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:outline-brand disabled:opacity-50'
interface Props {
  characters: Character[]
  initial?: BossPresetInput
  busy: boolean
  onSave: (input: BossPresetInput) => Promise<boolean>
  onCancel?: () => void
}
export function BossPresetForm({ characters, initial, busy, onSave, onCancel }: Props) {
  const id = useId()
  const [draft, setDraft] = useState({
    characterId: initial?.characterId ?? '',
    bossName: initial?.bossName ?? '',
    difficulty: initial?.difficulty ?? '노멀',
    partySize: String(initial?.partySize ?? 1),
    crystalPrice: String(initial?.crystalPrice ?? 0)
  })
  const [error, setError] = useState('')
  const options = characters.filter((row) => !row.isHidden || row.id === initial?.characterId)
  useEffect(() => {
    if (!initial)
      setDraft((current) =>
        characters.some((row) => !row.isHidden && row.id === current.characterId)
          ? current
          : { ...current, characterId: characters.find((row) => !row.isHidden)?.id ?? '' }
      )
  }, [characters, initial])
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const input = parseBossPreset({
        ...draft,
        partySize: parseDigits(draft.partySize),
        crystalPrice: parseDigits(draft.crystalPrice)
      })
      if ((await onSave(input)) && !initial) setDraft((current) => ({ ...current, bossName: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div>
        <label htmlFor={`${id}-character`} className="text-xs font-semibold">
          프리셋 캐릭터
        </label>
        <select
          id={`${id}-character`}
          value={draft.characterId}
          onChange={(event) => change('characterId', event.target.value)}
          disabled={busy || Boolean(initial) || !options.length}
          required
          className={bossFieldClass}
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
        <label htmlFor={`${id}-name`} className="text-xs font-semibold">
          주간 보스 이름
        </label>
        <input
          id={`${id}-name`}
          value={draft.bossName}
          onChange={(event) => change('bossName', event.target.value)}
          maxLength={60}
          placeholder="예: 스우"
          required
          disabled={busy || Boolean(initial)}
          className={bossFieldClass}
        />
      </div>
      <BossDetailsFields id={id} draft={draft} busy={busy} change={change} />
      <p className="text-[11px] leading-5 text-muted">
        결정석 가격은 파티 분배 전 금액입니다. 가격을 모르면 0으로 두고 판매 시 실제 받은 금액을
        입력하세요.
      </p>
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            취소
          </Button>
        )}
        <Button type="submit" disabled={busy || !options.length}>
          {busy ? '저장 중…' : initial ? '프리셋 수정 저장' : '프리셋 추가'}
        </Button>
      </div>
    </form>
  )
}
export function BossDetailsFields({
  id,
  draft,
  busy,
  change
}: {
  id: string
  draft: { difficulty: string; partySize: string; crystalPrice: string }
  busy: boolean
  change: (key: 'difficulty' | 'partySize' | 'crystalPrice', value: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-difficulty`} className="text-xs font-semibold">
            난이도
          </label>
          <input
            id={`${id}-difficulty`}
            value={draft.difficulty}
            onChange={(event) => change('difficulty', event.target.value)}
            maxLength={40}
            required
            disabled={busy}
            className={bossFieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-party`} className="text-xs font-semibold">
            파티 인원
          </label>
          <input
            id={`${id}-party`}
            type="number"
            min={1}
            max={6}
            step={1}
            value={draft.partySize}
            onChange={(event) => change('partySize', event.target.value)}
            required
            disabled={busy}
            className={bossFieldClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-price`} className="text-xs font-semibold">
          결정석 전체 가격 (메소)
        </label>
        <input
          id={`${id}-price`}
          inputMode="numeric"
          value={draft.crystalPrice}
          onChange={(event) => change('crystalPrice', event.target.value)}
          onBlur={() => {
            const value = parseDigits(draft.crystalPrice)
            if (Number.isSafeInteger(value)) change('crystalPrice', value.toLocaleString('ko-KR'))
          }}
          required
          disabled={busy}
          className={bossFieldClass}
        />
      </div>
    </>
  )
}
