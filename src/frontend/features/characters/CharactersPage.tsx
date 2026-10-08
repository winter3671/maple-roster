import { useState } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { CharacterCard } from './CharacterCard'
import { CharacterForm } from './CharacterForm'
import { useCharacters } from './useCharacters'
import { NexonCharacterImport } from '../nexon/NexonCharacterImport'

export function CharactersPage() {
  const state = useCharacters()
  const [showHidden, setShowHidden] = useState(false)
  const [editing, setEditing] = useState<Character | null>(null)
  const [deleting, setDeleting] = useState<Character | null>(null)
  const visible = state.characters.filter((character) => showHidden || !character.isHidden)
  const hiddenCount = state.characters.filter((character) => character.isHidden).length

  return (
    <div className="space-y-5">
      <NexonCharacterImport
        characters={state.characters}
        busy={state.busy || state.loading}
        onRegistered={state.reload}
      />
      {state.notice && (
        <p
          role="status"
          className="rounded-xl border border-brand/15 bg-brand-soft px-5 py-3 text-xs text-brand"
        >
          {state.notice}
        </p>
      )}
      {state.error && !editing && !deleting && (
        <p
          role="alert"
          className="rounded-xl border border-expense/20 bg-expense/5 px-5 py-3 text-xs text-expense"
        >
          {state.error}
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[280px_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">캐릭터 추가</h2>
          <p className="mb-6 mt-2 text-xs leading-5 text-muted">
            API 키 없이 이름과 월드로 시작하세요.
            <br />
            등록한 정보는 이 PC에 저장됩니다.
          </p>
          <CharacterForm busy={state.busy || state.loading} onSave={state.create} />
        </section>
        <section aria-busy={state.loading} className="rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
            <h2 className="text-sm font-semibold">
              나의 캐릭터 <span className="ml-2 text-brand">{visible.length}</span>
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(event) => setShowHidden(event.target.checked)}
                  className="accent-brand"
                />
                숨김 포함{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
              </label>
              <Button
                variant="secondary"
                onClick={() => void state.reload()}
                disabled={state.loading || state.busy}
              >
                새로고침
              </Button>
            </div>
          </div>
          {state.loading ? (
            <p role="status" className="p-10 text-center text-sm text-muted">
              캐릭터 목록을 불러오는 중…
            </p>
          ) : visible.length > 0 ? (
            <div className="grid gap-4 p-5 2xl:grid-cols-2">
              {visible.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  busy={state.busy}
                  onEdit={() => {
                    state.clearFeedback()
                    setEditing(character)
                  }}
                  onHide={() => void state.setHidden(character)}
                  onRemove={() => {
                    state.clearFeedback()
                    setDeleting(character)
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="characters"
              title={hiddenCount > 0 ? '표시 중인 캐릭터가 없어요' : '첫 캐릭터를 등록해 보세요'}
              description={
                hiddenCount > 0
                  ? '숨김 포함을 선택하면 숨겨둔 캐릭터를 다시 표시할 수 있습니다.'
                  : '이름과 월드를 입력하면 이곳에 캐릭터가 표시됩니다. 앱을 다시 열어도 기록은 유지됩니다.'
              }
            />
          )}
        </section>
      </div>
      {editing && (
        <Dialog title="캐릭터 수정" onClose={() => setEditing(null)} busy={state.busy}>
          {state.error && (
            <p role="alert" className="mb-4 text-xs leading-5 text-expense">
              {state.error}
            </p>
          )}
          <CharacterForm
            key={editing.id}
            initial={editing}
            busy={state.busy}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              const saved = await state.update(editing.id, input)
              if (saved) setEditing(null)
              return saved
            }}
          />
        </Dialog>
      )}
      {deleting && (
        <Dialog title="캐릭터 삭제" onClose={() => setDeleting(null)} busy={state.busy}>
          <p className="break-words text-sm leading-6">
            <strong>{deleting.name}</strong> ({deleting.world}) 캐릭터를 삭제할까요?
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            삭제한 정보는 복구할 수 없습니다. 목록에서만 제외하려면 숨기기를 사용하세요.
          </p>
          {state.error && (
            <p role="alert" className="mt-4 text-xs text-expense">
              {state.error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={state.busy}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={state.busy}
              onClick={() => {
                void state.remove(deleting.id).then((removed) => {
                  if (removed) setDeleting(null)
                })
              }}
            >
              {state.busy ? '삭제 중…' : '삭제 확인'}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
