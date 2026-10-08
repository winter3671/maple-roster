import type { Character } from '../../../shared/contracts/character.contract'
import { Button } from '../../components/ui/Button'

interface CharacterCardProps {
  character: Character
  busy: boolean
  onEdit: () => void
  onHide: () => void
  onRemove: () => void
  onSync: () => void
  onUnlink: () => void
}

export function CharacterCard({
  character,
  busy,
  onEdit,
  onHide,
  onRemove,
  onSync,
  onUnlink
}: CharacterCardProps) {
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
      {character.nexon ? (
        <div className="mt-4 rounded-lg bg-brand-soft p-3 text-xs leading-6">
          <p className="font-semibold text-brand">NEXON Open API 연결됨</p>
          {character.nexon.profile ? (
            <>
              <p>
                Lv. {character.nexon.profile.level} · {character.nexon.profile.job}
              </p>
              <p>길드: {character.nexon.profile.guild || '없음'}</p>
              <p className="text-[11px] text-muted">
                갱신:{' '}
                {new Date(character.nexon.profile.fetchedAt).toLocaleString('ko-KR', {
                  timeZone: 'Asia/Seoul'
                })}
              </p>
            </>
          ) : (
            <p>프로필 정보가 없습니다. API 정보 갱신을 눌러 다시 조회하세요.</p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-muted">
          수동 등록 · API 목록에서 다시 선택하면 연결할 수 있습니다.
        </p>
      )}
      {character.notes && (
        <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-6 text-muted">
          {character.notes}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {character.nexon && (
          <>
            <Button variant="secondary" onClick={onSync} disabled={busy}>
              API 정보 갱신
            </Button>
            <Button variant="secondary" onClick={onUnlink} disabled={busy}>
              API 연결 해제
            </Button>
          </>
        )}
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
