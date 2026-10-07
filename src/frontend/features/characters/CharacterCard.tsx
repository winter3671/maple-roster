import type { Character } from '../../../shared/contracts/character.contract'
import { Button } from '../../components/ui/Button'

interface CharacterCardProps {
  character: Character
  busy: boolean
  onEdit: () => void
  onHide: () => void
  onRemove: () => void
}

export function CharacterCard({ character, busy, onEdit, onHide, onRemove }: CharacterCardProps) {
  return (
    <article
      aria-label={`${character.name} · ${character.world}`}
      className={`rounded-xl border border-line p-5 ${character.isHidden ? 'bg-canvas' : 'bg-surface'}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg font-semibold text-brand">
          {Array.from(character.name)[0]}
        </span>
        <div className="min-w-0">
          <h3 className="break-all text-sm font-semibold">{character.name}</h3>
          <p className="mt-1 break-all text-xs text-muted">{character.world}</p>
        </div>
        {character.isHidden && (
          <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-1 text-[10px] text-muted">
            숨김
          </span>
        )}
      </div>
      {character.notes && (
        <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-6 text-muted">
          {character.notes}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onEdit} disabled={busy}>
          수정
        </Button>
        <Button variant="secondary" onClick={onHide} disabled={busy}>
          {character.isHidden ? '다시 표시' : '숨기기'}
        </Button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="ml-auto rounded-lg px-3 py-2 text-xs text-expense hover:bg-expense/5 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </article>
  )
}
