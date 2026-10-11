import { useEffect, useRef, useState } from 'react'
import type { AutomaticBackupStatus } from '../../../shared/contracts/backup.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { useTaskNotifications } from '../../components/TaskNotifications'

export function AutomaticBackupManager() {
  const tasks = useTaskNotifications()
  const [status, setStatus] = useState<AutomaticBackupStatus | null>(null)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const mounted = useRef(true),
    lock = useRef(false)
  async function load(save = false) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setSaving(save)
    setError('')
    const task = save ? tasks.begin('자동 백업') : undefined
    try {
      const result = await unwrap(
        save ? getBridge().backup.automaticNow() : getBridge().backup.automaticStatus()
      )
      if (mounted.current) setStatus(result)
      task?.finish(
        result.error ? 'error' : 'success',
        result.error
          ? '자동 백업에 실패했습니다. 설정에서 상세 오류를 확인해 주세요.'
          : '현재 장부를 자동 백업 폴더에 저장했습니다.'
      )
    } catch (caught) {
      task?.finish('error', '자동 백업을 완료하지 못했습니다. 다시 시도해 주세요.')
      if (mounted.current)
        setError(caught instanceof Error ? caught.message : '백업 상태를 확인하지 못했습니다.')
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void load()
    const timer = setInterval(() => void load(), 60_000)
    return () => {
      mounted.current = false
      clearInterval(timer)
    }
  }, [])
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">자동 백업</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        이 PC에 장부 사본을 자동으로 보관합니다. 앱 실행·정상 종료 시와 실행 중 1시간마다 변경된
        장부를 저장하고, 최근 30개를 유지합니다.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        API 키는 포함하지 않으며, 복원 직전 안전 백업은 별도로 보존합니다. 다른 기기에 보관하려면
        아래의 JSON 백업 저장을 사용하세요. 자동 백업 파일도 백업 파일로 복원에서 선택할 수
        있습니다.
      </p>
      {status && (
        <div className="mt-4 rounded-xl border border-line bg-canvas p-4 text-sm leading-6">
          <p>
            최근 백업:{' '}
            {status.lastSavedAt
              ? `${new Date(status.lastSavedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)`
              : '아직 저장된 백업이 없습니다.'}
          </p>
          <p className="mt-1 text-muted">보관 중: {status.count}개 / 최근 30개 유지</p>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer">백업 저장 위치 보기</summary>
            <div className="mt-2 space-y-2 break-all">
              <p>저장 위치: {status.directory}</p>
              {status.lastFilePath && <p>최근 파일: {status.lastFilePath}</p>}
            </div>
          </details>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void load(true)}>
          지금 자동 백업
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void load()}>
          백업 상태 새로고침
        </Button>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-xs text-muted">
          {saving ? '현재 장부를 백업하고 있습니다…' : '백업 상태를 확인하고 있습니다…'}
        </p>
      )}
      {(error || status?.error) && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error || status?.error}
        </p>
      )}
    </section>
  )
}
