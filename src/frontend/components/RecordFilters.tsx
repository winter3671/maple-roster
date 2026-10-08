import { useState, type FormEvent } from 'react'
import type { Character } from '../../shared/contracts/character.contract'
import { parseRecordQuery, type RecordQuery } from '../../shared/contracts/ledger.contract'
import { thisMonthQuery } from '../lib/format'
import { Button } from './ui/Button'

interface Props {
  initial: RecordQuery
  characters: Character[]
  busy: boolean
  onApply: (query: RecordQuery) => void
  showMonthShortcut?: boolean
}
const fieldClass =
  'rounded-lg border border-line bg-surface px-3 py-2 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50'

export function RecordFilters({
  initial,
  characters,
  busy,
  onApply,
  showMonthShortcut = true
}: Props) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      const query = parseRecordQuery(draft)
      setError(null)
      onApply(query)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '조회 기간을 확인해 주세요.')
    }
  }

  return (
    <form onSubmit={apply} className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-2 text-[11px] text-muted">
          <span className="block">조회 시작일</span>
          <input
            aria-label="조회 시작일"
            type="date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            required
            disabled={busy}
            className={fieldClass}
          />
        </label>
        <label className="space-y-2 text-[11px] text-muted">
          <span className="block">조회 종료일</span>
          <input
            aria-label="조회 종료일"
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            required
            disabled={busy}
            className={fieldClass}
          />
        </label>
        <label className="min-w-36 space-y-2 text-[11px] text-muted">
          <span className="block">조회 캐릭터</span>
          <select
            aria-label="조회 캐릭터"
            value={draft.characterId ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, characterId: event.target.value || undefined })
            }
            disabled={busy}
            className={`${fieldClass} w-full`}
          >
            <option value="">전체 캐릭터</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name} · {character.world}
                {character.isHidden ? ' (숨김)' : ''}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          조회
        </Button>
        {showMonthShortcut && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              const query = thisMonthQuery()
              setDraft(query)
              setError(null)
              onApply(query)
            }}
          >
            이번 달
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      )}
    </form>
  )
}
