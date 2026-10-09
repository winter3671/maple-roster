import { useEffect, useRef, useState } from 'react'
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
  const [editing, setEditing] = useState<Character | null>(null)
  const [deleting, setDeleting] = useState<Character | null>(null)
  const [unlinking, setUnlinking] = useState<Character | null>(null)
  const automaticStarted = useRef(false)
  useEffect(() => {
    if (!state.loading && !state.busy && !state.error && !automaticStarted.current) {
      automaticStarted.current = true
      void state.syncProfiles(false)
    }
  }, [state.loading, state.busy, state.error, state.syncProfiles])
  const visible = state.characters

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
      {state.error && !editing && !deleting && !unlinking && (
        <p
          role="alert"
          className="rounded-xl border border-expense/20 bg-expense/5 px-5 py-3 text-xs text-expense"
        >
          {state.error}
        </p>
      )}
      {Boolean(state.syncResult?.items.length) && (
        <div
          role="status"
          className="rounded-xl border border-line bg-surface p-4 text-xs leading-6"
        >
          <p>
            프로필 갱신 · 성공{' '}
            {state.syncResult!.items.filter((row) => row.status === 'updated').length}개 · 실패{' '}
            {state.syncResult!.items.filter((row) => row.status === 'failed').length}개 · 미처리{' '}
            {state.syncResult!.items.filter((row) => row.status === 'notAttempted').length}개
          </p>
          {state
            .syncResult!.items.filter((row) => row.status !== 'updated')
            .map((row) => (
              <p key={row.characterId} className="text-expense">
                {state.characters.find((character) => character.id === row.characterId)?.name ??
                  '캐릭터'}
                : {row.error.message}
              </p>
            ))}
        </div>
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
              <Button
                variant="secondary"
                disabled={state.loading || state.busy || !visible.some((row) => row.nexon)}
                onClick={() =>
                  void state.syncProfiles(
                    true,
                    visible.filter((row) => row.nexon).map((row) => row.id)
                  )
                }
              >
                API 프로필 모두 갱신
              </Button>
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
                  onSync={() => void state.syncProfiles(true, [character.id])}
                  onUnlink={() => {
                    state.clearFeedback()
                    setUnlinking(character)
                  }}
                  onEdit={() => {
                    state.clearFeedback()
                    setEditing(character)
                  }}
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
              title="첫 캐릭터를 등록해 보세요"
              description="이름과 월드를 입력하면 이곳에 캐릭터가 표시됩니다. 앱을 다시 열어도 기록은 유지됩니다."
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
      {unlinking && (
        <Dialog title="API 연결 해제" busy={state.busy} onClose={() => setUnlinking(null)}>
          <p className="text-sm leading-6">
            {unlinking.name}의 API 연결과 저장한 레벨·직업·길드 정보를 지웁니다. 이름·서버·메모와
            기존 장부는 유지됩니다.
          </p>
          {state.error && (
            <p role="alert" className="mt-3 text-xs text-expense">
              {state.error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={state.busy} onClick={() => setUnlinking(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={state.busy}
              onClick={() =>
                void state.unlink(unlinking.id).then((saved) => {
                  if (saved) setUnlinking(null)
                })
              }
            >
              연결 해제
            </Button>
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="캐릭터 삭제" onClose={() => setDeleting(null)} busy={state.busy}>
          <p className="break-words text-sm leading-6">
            <strong>{deleting.name}</strong> ({deleting.world}) 캐릭터를 삭제할까요?
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            삭제한 정보는 복구할 수 없습니다. 장부 기록이 연결된 캐릭터는 삭제할 수 없습니다.
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
