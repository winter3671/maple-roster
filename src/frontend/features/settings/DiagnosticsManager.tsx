import { useEffect, useRef, useState } from 'react'
import type { DiagnosticStatus } from '../../../shared/contracts/diagnostics.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { useTaskNotifications } from '../../components/TaskNotifications'

export function DiagnosticsManager() {
  const tasks = useTaskNotifications()
  const [status, setStatus] = useState<DiagnosticStatus>()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const mounted = useRef(true),
    lock = useRef(false)
  async function load() {
    try {
      const result = await unwrap(getBridge().diagnostics.status())
      if (mounted.current) setStatus(result)
    } catch {
      if (mounted.current) setError('진단 로그 상태를 확인하지 못했습니다. 다시 시도해 주세요.')
    }
  }
  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [])
  async function exportFile() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    const task = tasks.begin('진단 로그 저장')
    try {
      const result = await unwrap(getBridge().diagnostics.exportFile())
      if (result) {
        task.finish('success', `진단 기록 ${result.count}건을 저장했습니다.`)
        if (mounted.current) setNotice(`진단 로그를 저장했습니다: ${result.filePath}`)
      } else task.cancel()
      await load()
    } catch {
      task.finish(
        'error',
        '진단 로그를 저장하지 못했습니다. 저장 공간과 폴더 권한을 확인해 주세요.'
      )
      if (mounted.current) setError('진단 로그를 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">문제 진단</h2>
      <p className="mt-3 text-xs leading-6 text-muted">
        앱 실행·조회·저장 오류와 오래 걸린 요청을 이 PC에 기록합니다. 문제를 문의할 때 진단 파일을
        저장해 전달할 수 있습니다.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        API 키·캐릭터 정보·장부 내용·원본 오류 메시지는 포함하지 않습니다. 로그는 파일당 최대 512KB,
        최근 3개로 제한하며 자동으로 전송하지 않습니다.
      </p>
      {status && (
        <p className="mt-3 text-xs leading-6 text-muted">
          보관 중 {status.files}개 · {Math.ceil(status.bytes / 1024).toLocaleString('ko-KR')}KB
          {status.dropped > 0 ? ` · 기록 제한으로 제외 ${status.dropped}건` : ''}
        </p>
      )}
      {status?.writeIssue && (
        <p role="alert" className="mt-3 text-xs text-expense">
          일부 진단 기록을 저장하지 못했습니다. 저장 공간과 폴더 권한을 확인해 주세요. 장부 작업은
          계속 사용할 수 있습니다.
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button disabled={busy} onClick={() => void exportFile()}>
          {busy ? '진단 로그 저장 중…' : '진단 로그 저장'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setError('')
            void load()
          }}
        >
          상태 새로고침
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 break-all text-xs leading-6 text-brand">
          {notice}
        </p>
      )}
    </section>
  )
}
