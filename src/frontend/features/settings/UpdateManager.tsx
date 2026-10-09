import { useEffect, useRef, useState } from 'react'
import type { UpdateStatus } from '../../../shared/contracts/update.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'

export function UpdateManager() {
  const [status, setStatus] = useState<UpdateStatus>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const alive = useRef(false),
    lock = useRef(false)
  useEffect(() => {
    alive.current = true
    async function refresh() {
      try {
        const result = await unwrap(getBridge().updates.status())
        if (alive.current) setStatus(result)
      } catch {
        if (alive.current) setError('업데이트 상태를 불러오지 못했습니다. 앱을 재실행해 주세요.')
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 1000)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [])
  async function action(kind: 'check' | 'download' | 'install') {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await unwrap(getBridge().updates[kind]())
      if (alive.current) {
        setStatus(result)
        setConfirm(false)
      }
    } catch (caught) {
      if (alive.current)
        setError(caught instanceof Error ? caught.message : '업데이트를 처리하지 못했습니다.')
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  const active = busy || !status || ['checking', 'downloading', 'installing'].includes(status.phase)
  return (
    <section
      className="rounded-2xl border border-line bg-surface p-6"
      aria-labelledby="update-heading"
    >
      <h2 id="update-heading" className="text-sm font-semibold">
        앱 업데이트
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        최신 버전을 확인하고 다운로드한 뒤 재시작하여 적용합니다. 적용 전에 장부를 자동 백업합니다.
      </p>
      <p className="mt-2 text-xs text-muted">
        현재 v{status?.currentVersion ?? '확인 중'}
        {status?.latestVersion ? ` · 새 버전 v${status.latestVersion}` : ''} · GitHub Releases
      </p>
      <p
        role={status?.phase === 'error' ? 'alert' : 'status'}
        className={`mt-3 text-xs leading-6 ${status?.phase === 'error' ? 'text-expense' : 'text-muted'}`}
      >
        {status?.message ?? '업데이트 상태 확인 중…'}
      </p>
      {status?.phase === 'downloading' && (
        <div className="mt-3 space-y-1">
          <progress
            aria-label="업데이트 다운로드 진행률"
            max={100}
            value={status.progress}
            className="w-full accent-brand"
          />
          <p className="text-xs text-muted">{Math.floor(status.progress)}%</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      )}
      {confirm ? (
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="text-sm leading-6">
            앱이 종료되고 업데이트된 버전으로 다시 실행됩니다. 작성 중인 입력을 저장한 뒤 진행해
            주세요.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
              돌아가기
            </Button>
            <Button disabled={active} onClick={() => void action('install')}>
              백업 후 재시작하여 적용
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={active || status?.phase === 'disabled' || status?.phase === 'downloaded'}
            onClick={() => void action('check')}
          >
            업데이트 확인
          </Button>
          {status?.phase === 'available' && (
            <Button disabled={active} onClick={() => void action('download')}>
              업데이트 다운로드
            </Button>
          )}
          {status?.phase === 'downloaded' && (
            <Button disabled={active} onClick={() => setConfirm(true)}>
              재시작하여 적용
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
