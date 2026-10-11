export type TaskStatus = 'running' | 'success' | 'warning' | 'error'
export interface TaskNotification {
  id: number
  title: string
  status: TaskStatus
  message: string
  expiresAt?: number
}
export interface TaskHandle {
  finish: (status: Exclude<TaskStatus, 'running'>, message: string) => void
  cancel: () => void
}

export function batchTaskStatus(
  succeeded: number,
  incomplete: number
): Exclude<TaskStatus, 'running'> {
  return incomplete === 0 ? 'success' : succeeded > 0 ? 'warning' : 'error'
}

// Only display messages belong here. API credentials and responses stay outside the store.
export class TaskNotificationStore {
  private rows: readonly TaskNotification[] = []
  private listeners = new Set<() => void>()
  private sequence = 0
  constructor(private readonly now: () => number = Date.now) {}
  snapshot = () => this.rows
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  isRunning = () => this.rows.some((row) => row.status === 'running')
  private publish(rows: readonly TaskNotification[]) {
    const completed = rows.filter((row) => row.status !== 'running').slice(-3)
    this.rows = rows.filter((row) => row.status === 'running' || completed.includes(row))
    for (const listener of this.listeners) listener()
  }
  begin(title: string): TaskHandle {
    const id = ++this.sequence
    this.publish([...this.rows, { id, title, status: 'running', message: '처리 중…' }])
    let settled = false
    return {
      finish: (status, message) => {
        if (settled) return
        settled = true
        this.publish([
          ...this.rows.filter((row) => row.id !== id),
          {
            id,
            title,
            status,
            message,
            expiresAt: status === 'success' ? this.now() + 8000 : undefined
          }
        ])
      },
      cancel: () => {
        if (settled) return
        settled = true
        this.publish(this.rows.filter((row) => row.id !== id))
      }
    }
  }
  dismiss(id: number) {
    this.publish(this.rows.filter((row) => row.id !== id || row.status === 'running'))
  }
  expire() {
    this.publish(
      this.rows.filter((row) => row.expiresAt === undefined || row.expiresAt > this.now())
    )
  }
}
