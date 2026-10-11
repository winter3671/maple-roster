import { useEffect, useRef, useState } from 'react'
import type { UpdateStatus } from '../../../shared/contracts/update.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useInputProtection } from '../../components/InputProtection'
import { useTaskNotifications } from '../../components/TaskNotifications'

export function StartupUpdatePrompt() {
  const { request } = useInputProtection()
  const tasks = useTaskNotifications()
  const [status, setStatus] = useState<UpdateStatus>()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const initial = useRef<Promise<UpdateStatus> | null>(null)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    // Share the startup request across StrictMode's effect replay. Menu changes do not remount us.
    initial.current ??= (async () => {
      const updates = getBridge().updates
      const current = await unwrap(updates.status())
      if (current.phase === 'disabled') return current
      return unwrap(updates.check())
    })()
    async function receive(result: UpdateStatus) {
      if (!active) return
      if (result.phase === 'checking') {
        timer = setTimeout(() => {
          void unwrap(getBridge().updates.status())
            .then(receive)
            .catch(() => {})
        }, 1000)
        return
      }
      if (['available', 'downloaded'].includes(result.phase)) {
        setStatus(result)
        setOpen(true)
      }
    }
    // A failed startup check must not prevent use of the installed version.
    void initial.current.then(receive).catch(() => {})
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!busy) return
    let active = true
    const timer = setInterval(() => {
      void unwrap(getBridge().updates.status())
        .then((result) => {
          if (active) setStatus(result)
        })
        .catch(() => {})
    }, 1000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [busy])

  async function run(kind: 'check' | 'download' | 'install') {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    if (kind !== 'install')
      setStatus((current) =>
        current
          ? {
              ...current,
              phase: kind === 'check' ? 'checking' : 'downloading',
              progress: 0,
              message:
                kind === 'check'
                  ? '최신 버전을 다시 확인하고 있습니다…'
                  : '업데이트 파일을 다운로드하고 있습니다…'
            }
          : current
      )
    const task = tasks.begin(
      kind === 'check'
        ? '업데이트 확인'
        : kind === 'download'
          ? '업데이트 다운로드'
          : '업데이트 적용'
    )
    try {
      const result = await unwrap(getBridge().updates[kind]())
      setStatus(result)
      if (result.phase === 'error') {
        task.finish('error', result.message)
      } else {
        task.finish('success', result.message)
        if (result.phase === 'current' || result.phase === 'disabled') setOpen(false)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '업데이트를 처리하지 못했습니다.')
      // Restore the real service phase so an IPC failure cannot leave the dialog busy forever.
      try {
        setStatus(await unwrap(getBridge().updates.status()))
      } catch {
        setStatus((current) =>
          current
            ? { ...current, phase: 'error', message: '업데이트 상태를 확인하지 못했습니다.' }
            : current
        )
      }
      task.finish('error', '업데이트를 완료하지 못했습니다. 현재 버전으로 계속 사용할 수 있습니다.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (!open || !status) return null
  const downloaded = status.phase === 'downloaded'
  const failed = status.phase === 'error'
  const active = busy || ['checking', 'downloading', 'installing'].includes(status.phase)
  return (
    <Dialog title="새 업데이트가 있습니다" busy={active} onClose={() => setOpen(false)}>
      <p className="break-keep text-sm font-semibold">
        현재 v{status.currentVersion}
        {status.latestVersion ? ` → 새 버전 v${status.latestVersion}` : ''}
      </p>
      <p className="mt-3 break-keep text-sm leading-6 text-muted">
        {downloaded ? '다운로드가 완료되었습니다.' : '업데이트를 다운로드할까요?'}
      </p>
      <p className="mt-2 break-keep text-sm leading-6 text-muted">
        {downloaded
          ? '장부를 자동 백업한 뒤 앱을 재시작하여 적용합니다.'
          : '취소하면 현재 버전으로 계속 사용할 수 있습니다. 설정에서 언제든 업데이트할 수 있습니다.'}
      </p>
      {(active || downloaded || failed) && (
        <p
          role={failed ? 'alert' : 'status'}
          className={`mt-3 break-keep text-xs leading-6 ${failed ? 'text-expense' : 'text-muted'}`}
        >
          {status.message}
        </p>
      )}
      {status.phase === 'downloading' && (
        <div className="mt-3">
          <progress
            aria-label="업데이트 다운로드 진행률"
            max={100}
            value={status.progress}
            className="w-full accent-brand"
          />
          <p className="mt-1 text-xs text-muted">{Math.floor(status.progress)}%</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 break-keep text-xs leading-6 text-expense">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          className="w-full whitespace-nowrap sm:w-auto"
          variant="secondary"
          disabled={active}
          onClick={() => setOpen(false)}
        >
          취소하고 현재 버전 사용
        </Button>
        <Button
          className="w-full whitespace-nowrap sm:w-auto"
          disabled={active}
          onClick={() => {
            if (downloaded) request(() => void run('install'), undefined, 'exit')
            else void run(failed ? 'check' : 'download')
          }}
        >
          {downloaded ? '백업 후 재시작하여 적용' : failed ? '다시 확인' : '업데이트 다운로드'}
        </Button>
      </div>
    </Dialog>
  )
}
