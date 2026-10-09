import type { Character } from '../../../shared/contracts/character.contract'
import { Button } from '../../components/ui/Button'
import { CharacterAvatar } from '../../components/CharacterAvatar'

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
      <div className="flex flex-wrap items-center gap-6">
        <CharacterAvatar character={character} size="large" />
        <div className="min-w-0 flex-1 basis-52 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-all text-lg font-semibold">{character.name}</h3>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
              {character.world}
            </span>
            {character.isHidden && (
              <span className="rounded-full border border-line px-2 py-1 text-[10px] text-muted">
                숨김
              </span>
            )}
          </div>
          {character.nexon?.profile && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted">직업</dt>
              <dd className="min-w-0 break-words font-medium">{character.nexon.profile.job}</dd>
              <dt className="text-muted">레벨</dt>
              <dd className="font-medium">Lv. {character.nexon.profile.level}</dd>
              <dt className="text-muted">길드</dt>
              <dd className="min-w-0 break-words font-medium">
                {character.nexon.profile.guild || '없음'}
              </dd>
            </dl>
          )}
          {character.nexon ? (
            <div className="space-y-1 text-[11px] leading-5">
              <p className="flex items-center gap-1.5 text-brand">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand" />
                NEXON Open API 연결됨
              </p>
              {character.nexon.profile ? (
                <p className="text-muted">
                  갱신:{' '}
                  {new Date(character.nexon.profile.fetchedAt).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul'
                  })}
                </p>
              ) : (
                <p className="text-muted">
                  프로필 정보가 없습니다. API 정보 갱신을 눌러 다시 조회하세요.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] leading-5 text-muted">
              수동 등록 · API 목록에서 다시 선택하면 연결할 수 있습니다.
            </p>
          )}
        </div>
      </div>
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
