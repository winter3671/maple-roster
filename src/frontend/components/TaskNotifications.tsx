import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { TaskNotificationStore } from '../../shared/task-notifications'

const Context = createContext<TaskNotificationStore | null>(null)
const labels = { running: '진행 중', success: '완료', warning: '일부 확인 필요', error: '실패' }

export function TaskNotificationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new TaskNotificationStore())
  const rows = useSyncExternalStore(store.subscribe, store.snapshot)
  useEffect(() => {
    const expiry = Math.min(...rows.map((row) => row.expiresAt ?? Infinity))
    if (!Number.isFinite(expiry)) return
    const timer = setTimeout(() => store.expire(), Math.max(0, expiry - Date.now()))
    return () => clearTimeout(timer)
  }, [rows, store])
  return (
    <Context.Provider value={store}>
      {children}
      <aside
        aria-label="작업 알림"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-h-[50vh] w-[min(90vw,360px)] flex-col gap-2 overflow-y-auto"
      >
        {rows.map((row) => (
          <div
            key={row.id}
            role={row.status === 'error' || row.status === 'warning' ? 'alert' : 'status'}
            aria-atomic="true"
            className="pointer-events-auto rounded-xl border border-line bg-surface p-4 text-sm text-ink shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{row.title}</p>
              {row.status !== 'running' && (
                <button
                  type="button"
                  aria-label={`${row.title} 알림 닫기`}
                  onClick={() => store.dismiss(row.id)}
                  className="shrink-0 text-muted"
                >
                  ×
                </button>
              )}
            </div>
            <p
              className={`mt-2 text-xs ${row.status === 'warning' || row.status === 'error' ? 'text-expense' : 'text-brand'}`}
            >
              {row.status === 'running' && (
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none"
                />
              )}
              {labels[row.status]}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">{row.message}</p>
          </div>
        ))}
      </aside>
    </Context.Provider>
  )
}
export function useTaskNotifications() {
  const store = useContext(Context)
  if (!store) throw new Error('TaskNotificationProvider가 필요합니다.')
  return store
}
