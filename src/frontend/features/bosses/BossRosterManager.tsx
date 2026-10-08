import { useState } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type {
  BossMember,
  BossRoster,
  BossRosterState,
  BossTemplate
} from '../../../shared/contracts/boss-roster.contract'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { BossRosterEditor } from './BossRosterEditor'
import { BossIcon } from './BossIcon'
import { bossesApi } from './bosses.api'

const example: BossMember[] = [
  ['스우', '익스트림'],
  ['찬란한 흉성', '노멀'],
  ['최초의 대적자', '노멀'],
  ['감시자 칼로스', '노멀'],
  ['벨로나', '이지'],
  ['카링', '이지'],
  ['선택받은 세렌', '하드'],
  ['진 힐라', '하드'],
  ['듄켈', '하드'],
  ['윌', '하드'],
  ['가디언 엔젤 슬라임', '카오스'],
  ['더스크', '카오스']
].map(([bossName, difficulty]) => ({ bossName, difficulty, partySize: 1 }))

function BossMemberIcons({ members }: { members: BossMember[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member, index) => (
        <div
          key={`${member.bossName}-${index}`}
          className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2 py-1.5"
          title={`${member.difficulty} ${member.bossName} (${member.partySize}명)`}
        >
          <BossIcon bossName={member.bossName} difficulty={member.difficulty} small />
          <span className="text-[11px] leading-5">
            <span className="block font-semibold">{member.bossName}</span>
            <span className="text-muted">
              {member.difficulty} · {member.partySize}명
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function BossRosterManager({
  state,
  characters,
  characterId,
  busy,
  error,
  mutate
}: {
  state: BossRosterState
  characters: Character[]
  characterId?: string
  busy: boolean
  error: string
  mutate: (operation: () => Promise<unknown>, message: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState<{
    id?: string
    name: string
    members: BossMember[]
  } | null>(null)
  const [roster, setRoster] = useState<BossRoster | null>(null)
  const [assigning, setAssigning] = useState<BossTemplate | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState<BossTemplate | null>(null)
  const visibleCharacters = characters.filter((row) => !characterId || row.id === characterId)
  const membersText = (members: BossMember[]) =>
    members.map((row) => `${row.difficulty} ${row.bossName} (${row.partySize}명)`).join(' · ')
  const feedback = error && (
    <p role="alert" className="mb-4 text-xs text-expense">
      {error}
    </p>
  )
  return (
    <section className="space-y-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">보스 묶음 프리셋</h2>
          <p className="mt-2 text-xs text-muted">
            최대 12개 보스를 묶어 저장하고 여러 캐릭터에게 한 번에 할당하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setEditing({ name: '익세노흉', members: example })}
          >
            익세노흉 예시로 만들기
          </Button>
          <Button disabled={busy} onClick={() => setEditing({ name: '', members: [] })}>
            묶음 프리셋 만들기
          </Button>
        </div>
      </div>
      {!state.templates.length && (
        <p className="rounded-xl bg-canvas p-4 text-xs text-muted">
          공용 프리셋을 먼저 만들어 주세요. 아래 캐릭터의 기존 구성을 공용 프리셋으로 저장할 수도
          있습니다.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {state.templates.map((template) => (
          <article key={template.id} className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">
              {template.name}{' '}
              <span className="font-normal text-muted">· {template.members.length}/12개</span>
            </p>
            <BossMemberIcons members={template.members} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  setAssigning(template)
                  setSelected(
                    characterId && !characters.find((row) => row.id === characterId)?.isHidden
                      ? [characterId]
                      : []
                  )
                }}
              >
                캐릭터에 할당
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setEditing(template)}>
                묶음 수정
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setDeleting(template)}>
                묶음 삭제
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="border-t border-line pt-5">
        <h3 className="text-sm font-semibold">캐릭터별 보스 구성</h3>
        <p className="mt-2 text-xs leading-5 text-muted">
          할당 시 공용 프리셋을 복사합니다. 이후 캐릭터별 변경은 다른 캐릭터에 영향을 주지 않습니다.
          주차 생성은 이 구성을 사용합니다.
        </p>
        <div className="mt-4 space-y-3">
          {visibleCharacters.map((character) => {
            const assigned = state.rosters.find((row) => row.characterId === character.id)
            return (
              <article key={character.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {character.name} · {character.world}
                    {character.isHidden ? ' (숨김)' : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {assigned
                      ? `${assigned.name} · ${assigned.members.length}/12개${assigned.customized ? ' · 개별 수정' : ''}`
                      : '미할당'}
                  </p>
                </div>
                {assigned ? (
                  <div className="mt-3">
                    <BossMemberIcons members={assigned.members} />
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-6 text-muted">
                    위의 묶음 프리셋에서 이 캐릭터를 선택해 할당하세요.
                  </p>
                )}
                {assigned && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy || character.isHidden}
                      onClick={() => setRoster(assigned)}
                    >
                      캐릭터 구성 수정
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || assigned.members.length > 12 || !assigned.members.length}
                      onClick={() =>
                        setEditing({ name: `${character.name} 구성`, members: assigned.members })
                      }
                    >
                      공용 프리셋으로 저장
                    </Button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
      {editing && (
        <Dialog
          wide
          title={editing.id ? '보스 묶음 수정' : '보스 묶음 만들기'}
          busy={busy}
          onClose={() => setEditing(null)}
        >
          {feedback}
          <BossRosterEditor
            initial={editing.members}
            initialName={editing.name}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (members, name) => {
              const saved = await mutate(
                () => bossesApi.saveTemplate({ id: editing.id, name, members }),
                '보스 묶음을 저장했습니다. 기존 캐릭터 구성은 유지됩니다.'
              )
              if (saved) setEditing(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {roster && (
        <Dialog
          wide
          title={`${characters.find((row) => row.id === roster.characterId)?.name} 보스 구성 수정`}
          busy={busy}
          onClose={() => setRoster(null)}
        >
          {feedback}
          <BossRosterEditor
            initial={roster.members}
            named={false}
            busy={busy}
            onCancel={() => setRoster(null)}
            onSave={async (members) => {
              const saved = await mutate(
                () => bossesApi.saveRoster(roster.characterId, members),
                '이 캐릭터의 보스 구성을 수정했습니다. 기존 주차는 유지됩니다.'
              )
              if (saved) setRoster(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {assigning && (
        <Dialog
          wide
          title={`${assigning.name} 할당`}
          busy={busy}
          onClose={() => setAssigning(null)}
        >
          {feedback}
          <p className="text-xs leading-6 text-muted">
            {assigning.members.length}개 · {membersText(assigning.members)}
          </p>
          <div className="my-4 space-y-2">
            {characters
              .filter((row) => !row.isHidden)
              .map((character) => (
                <label
                  key={character.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={selected.includes(character.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, character.id]
                          : current.filter((id) => id !== character.id)
                      )
                    }
                  />
                  {character.name} · {character.world}
                  <span className="text-xs text-muted">
                    {state.rosters.find((row) => row.characterId === character.id)?.name ??
                      '미할당'}
                  </span>
                </label>
              ))}
          </div>
          <p className="rounded-xl bg-brand-soft p-3 text-xs leading-6">
            선택한 캐릭터의 현재 보스 구성을 이 묶음으로 교체합니다. 개별 수정 내용도 교체되며, 이미
            생성한 주차·판매 기록은 유지됩니다.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setAssigning(null)}>
              취소
            </Button>
            <Button
              disabled={busy || !selected.length}
              onClick={() =>
                void mutate(
                  () => bossesApi.assignTemplate(assigning.id, selected),
                  `${selected.length}개 캐릭터에게 보스 묶음을 할당했습니다.`
                ).then((saved) => {
                  if (saved) setAssigning(null)
                })
              }
            >
              {selected.length}개 캐릭터에 할당
            </Button>
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="공용 보스 묶음 삭제" busy={busy} onClose={() => setDeleting(null)}>
          {feedback}
          <p className="text-sm leading-6">
            {deleting.name} 공용 프리셋을 삭제합니다. 이미 할당한 캐릭터의 구성과 주차·판매 기록은
            유지됩니다.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void mutate(
                  () => bossesApi.removeTemplate(deleting.id),
                  '공용 프리셋을 삭제했습니다. 캐릭터 구성은 유지됩니다.'
                ).then((saved) => {
                  if (saved) setDeleting(null)
                })
              }
            >
              묶음 삭제 확정
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
