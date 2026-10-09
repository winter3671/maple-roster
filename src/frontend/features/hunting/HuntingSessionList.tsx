import type { HuntingSession } from '../../../shared/contracts/hunting.contract'
import { formatMeso, formatMinutes } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import type { Character } from '../../../shared/contracts/character.contract'
import { CharacterAvatar } from '../../components/CharacterAvatar'

export function HuntingSessionList({
  sessions,
  characters,
  busy,
  onEdit,
  onDrops,
  onRemove
}: {
  sessions: HuntingSession[]
  characters: Character[]
  busy: boolean
  onEdit: (session: HuntingSession) => void
  onDrops: (session: HuntingSession) => void
  onRemove: (session: HuntingSession) => void
}) {
  return (
    <div className="space-y-3 p-5">
      {sessions.map((session) => (
        <article
          key={session.id}
          aria-label={`${session.characterName} · ${session.date} · ${session.notes || '사냥'}`}
          className="rounded-xl border border-line p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <CharacterAvatar
                character={characters.find((row) => row.id === session.characterId)}
                name={session.characterName}
              />
              <div>
                <h3 className="break-all text-sm font-semibold">
                  {session.characterName}
                  <span className="ml-2 text-[11px] font-normal text-muted">
                    {session.characterWorld}
                  </span>
                </h3>
                <p className="mt-2 text-xs text-muted">
                  {session.date} · {formatMinutes(session.minutes)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => onDrops(session)}>
                드랍 관리
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => onEdit(session)}>
                수정
              </Button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(session)}
                className="rounded-lg px-3 py-2 text-xs text-expense hover:bg-expense/5 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs xl:grid-cols-4">
            {[
              { label: '획득 메소', value: formatMeso(session.mesos), color: 'text-brand' },
              {
                label: '드랍 판매 수익',
                value: formatMeso(session.saleIncome),
                color: 'text-brand'
              },
              {
                label: '순수익',
                value: formatMeso(session.net),
                color: session.net < 0 ? 'text-expense' : 'text-ink'
              },
              {
                label: '시간당 순수익',
                value: session.hourlyNet === null ? '시간 미기록' : formatMeso(session.hourlyNet),
                color: 'text-ink'
              }
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[11px] text-muted">{item.label}</dt>
                <dd className={`mt-2 break-all font-semibold tabular-nums ${item.color}`}>
                  {item.value}
                  {item.value !== '시간 미기록' && (
                    <span className="ml-1 text-[10px] font-normal text-muted">메소</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] text-muted">
            조각 {formatMeso(session.solFragments)}개
            {session.nodestones > 0 && <> · 젬스톤 {formatMeso(session.nodestones)}개</>}
            <span className="ml-2">획득 수량</span>
          </p>
          {session.cost > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              이전 기록의 비용 {formatMeso(session.cost)} 메소가 순수익에 포함되어 있습니다.
            </p>
          )}
          {session.notes && (
            <p className="mt-3 whitespace-pre-wrap break-words border-t border-line pt-3 text-xs leading-5 text-muted">
              {session.notes}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}
