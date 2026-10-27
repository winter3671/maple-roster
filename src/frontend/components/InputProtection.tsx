import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import {
  InputProtectionStore,
  type ProtectedInput,
  type DraftKey
} from '../../shared/input-protection'
import { Button } from './ui/Button'
import { useTaskNotifications } from './TaskNotifications'

type Mode = 'navigate' | 'discard' | 'exit'
interface Request {
  action: () => void
  scope?: HTMLElement | null
  mode: Mode
  blocked: boolean
}
const Context = createContext<{
  store: InputProtectionStore<HTMLElement>
  request: (action: () => void, scope?: HTMLElement | null, mode?: Mode) => void
} | null>(null)

export function InputProtectionProvider({ children }: { children: ReactNode }) {
  const tasks = useTaskNotifications()
  const taskRows = useSyncExternalStore(tasks.subscribe, tasks.snapshot)
  const [store] = useState(() => new InputProtectionStore<HTMLElement>())
  const [pending, setPending] = useState<Request | null>(null)
  const pendingRef = useRef<Request | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [closeError, setCloseError] = useState('')
  const request = (action: () => void, scope?: HTMLElement | null, mode: Mode = 'navigate') => {
    if (pendingRef.current) return
    const state = store.snapshot(scope, mode === 'exit')
    const blocked = state.busy || tasks.isRunning(mode !== 'exit')
    if (!state.dirty && !blocked) {
      action()
      return
    }
    pendingRef.current = { action, scope, mode, blocked }
    setPending(pendingRef.current)
  }
  function dismiss() {
    pendingRef.current = null
    setPending(null)
  }
  useEffect(() => {
    // Release the wait dialog before a completed job opens its own result dialog.
    // The user's navigation/exit action is not replayed automatically.
    if (
      pending?.blocked &&
      !tasks.isRunning(pending.mode !== 'exit') &&
      !store.snapshot(pending.scope, pending.mode === 'exit').busy
    )
      dismiss()
  }, [taskRows, pending, tasks, store])
  function proceed() {
    const current = pendingRef.current
    if (!current) return
    // Recheck after confirmation: a save may have started while the dialog was open.
    if (
      store.snapshot(current.scope, current.mode === 'exit').busy ||
      tasks.isRunning(current.mode !== 'exit')
    ) {
      pendingRef.current = { ...current, blocked: true }
      setPending(pendingRef.current)
      return
    }
    // Exiting keeps drafts intact until the main process actually closes the window.
    if (current.mode === 'discard') store.discard(current.scope)
    dismiss()
    current.action()
  }
  useEffect(() => {
    if (!pending) return
    dialog.current?.showModal()
    return () => dialog.current?.close()
  }, [pending !== null])
  useEffect(() => {
    if (window.location.hash === '#update-recovery') return
    const system = window.maple.system
    const unsubscribe = system.onCloseRequested(() => {
      request(
        () => {
          void system.allowClose().then((result) => {
            if (!result.ok) setCloseError(result.error.message)
          })
        },
        undefined,
        'exit'
      )
    })
    void system.protectionReady()
    return unsubscribe
  }, [store, tasks])
  return (
    <Context.Provider value={{ store, request }}>
      {children}
      {closeError && (
        <p
          role="alert"
          className="fixed bottom-5 right-5 z-50 rounded-xl border border-line bg-surface p-4 text-sm text-expense"
        >
          {closeError}
          <button className="ml-4" onClick={() => setCloseError('')}>
            닫기
          </button>
        </p>
      )}
      {pending && (
        <dialog
          ref={dialog}
          aria-labelledby="input-protection-title"
          onCancel={(event) => {
            event.preventDefault()
            dismiss()
          }}
          className="m-auto w-[min(90vw,460px)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
        >
          <h2 id="input-protection-title" className="font-semibold">
            {pending.blocked ? '작업 완료를 기다려 주세요' : '저장하지 않은 입력이 있습니다'}
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted">
            {pending.blocked
              ? '처리 중에는 화면 이동이나 종료를 할 수 없습니다. 작업이 끝난 뒤 다시 시도해 주세요.'
              : pending.mode === 'navigate'
                ? '이동하시겠어요? 새 사냥·수익·지출·캐릭터 입력은 앱을 켜 둔 동안 임시 보관됩니다. 수정 중인 기록과 API 키 입력은 사라집니다.'
                : pending.mode === 'exit'
                  ? '앱을 종료하면 저장하지 않은 입력과 임시 보관한 입력이 사라집니다. 종료하시겠어요?'
                  : '저장하지 않은 변경 사항을 버리고 닫으시겠어요?'}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={dismiss}>
              {pending.blocked ? '확인' : '계속 입력'}
            </Button>
            {!pending.blocked && (
              <Button onClick={proceed}>
                {pending.mode === 'navigate'
                  ? '이동'
                  : pending.mode === 'exit'
                    ? '입력 버리고 종료'
                    : '변경 버리기'}
              </Button>
            )}
          </div>
        </dialog>
      )}
    </Context.Provider>
  )
}

export function useInputProtection() {
  const context = useContext(Context)
  if (!context) throw new Error('InputProtectionProvider가 필요합니다.')
  return context
}

export function useFormProtection<T>(value: T, busy: boolean, draftKey?: DraftKey) {
  const { store, request } = useInputProtection()
  const id = useRef(crypto.randomUUID())
  const ref = useRef<HTMLFormElement>(null)
  const existing = draftKey ? store.read<T>(draftKey) : undefined
  const baseline = useRef(existing?.baseline ?? JSON.stringify(value))
  const touched = useRef(Boolean(existing))
  const restored = useRef(touched.current)
  const saving = useRef(false)
  const currentValue = useRef(value)
  currentValue.current = value
  const entry = useRef<ProtectedInput<HTMLElement>>({
    element: null,
    dirty: false,
    busy: false,
    discard: () => {}
  })
  entry.current.discard = () => {
    touched.current = false
    baseline.current = JSON.stringify(currentValue.current)
    entry.current.dirty = false
    if (draftKey) store.forget(draftKey)
  }
  useLayoutEffect(() => {
    const fingerprint = JSON.stringify(value)
    if (!touched.current) baseline.current = fingerprint
    entry.current.element = ref.current
    entry.current.dirty = touched.current && fingerprint !== baseline.current
    entry.current.busy = busy || saving.current
    store.inputs.set(id.current, entry.current)
    if (draftKey) {
      if (entry.current.dirty) store.remember(draftKey, value, baseline.current)
      else store.forget(draftKey)
    }
  })
  useLayoutEffect(
    () => () => {
      store.inputs.delete(id.current)
    },
    [store]
  )
  async function save(operation: () => Promise<boolean>): Promise<boolean> {
    if (busy || saving.current) return false
    saving.current = true
    entry.current.busy = true
    try {
      const saved = await operation()
      if (saved) entry.current.discard()
      return saved
    } finally {
      saving.current = false
      entry.current.busy = busy
    }
  }
  const touch = () => {
    touched.current = true
  }
  return {
    formProps: { ref, onChangeCapture: touch, onClickCapture: touch },
    save,
    cancel: (action: () => void) => request(action, ref.current, 'discard'),
    restored: restored.current && touched.current
  }
}

export function useProtectedDraft<T>(
  key: DraftKey | undefined,
  initial: T | (() => T),
  busy: boolean
) {
  const { store } = useInputProtection()
  const [value, setValue] = useState<T>(
    () =>
      (key ? store.read<T>(key)?.value : undefined) ??
      (typeof initial === 'function' ? (initial as () => T)() : initial)
  )
  const protection = useFormProtection(value, busy, key)
  return [value, setValue, protection] as const
}

export function DraftRestoredNotice({ visible }: { visible: boolean }) {
  return visible ? (
    <p role="status" className="mb-3 text-xs leading-5 text-brand">
      이전 입력을 복원했습니다. 저장을 눌러야 장부에 반영됩니다.
    </p>
  ) : null
}
