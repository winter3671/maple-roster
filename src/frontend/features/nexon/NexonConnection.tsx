import { useEffect, useRef, useState } from 'react'
import type { NexonStatus } from '../../../shared/contracts/nexon.contract'
import { Button } from '../../components/ui/Button'
import { nexonApi } from './nexon.api'

export function NexonConnection() {
  const [status, setStatus] = useState<NexonStatus>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  useEffect(() => {
    active.current = true
    void nexonApi
      .status()
      .then((value) => {
        if (active.current) setStatus(value)
      })
      .catch(() => {
        if (active.current) setError('API 설정을 확인하지 못했습니다.')
      })
    return () => {
      active.current = false
    }
  }, [])
  async function test() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const rows = await nexonApi.list()
      if (active.current) setMessage(`연결 성공 · 조회 가능한 캐릭터 ${rows.length}개`)
    } catch (caught) {
      if (active.current)
        setError(caught instanceof Error ? caught.message : '연결에 실패했습니다.')
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">넥슨 API 연결</h2>
        <span className="text-xs text-muted">
          {status ? (status.configured ? '로컬 키 설정됨' : '키 설정 필요') : '확인 중'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        개인 API 키로 내 캐릭터 목록을 조회합니다. 캐릭터 관리에서 필요한 캐릭터를 선택해 장부에
        등록하세요.
      </p>
      {!status?.configured && status && (
        <p className="mt-3 text-xs leading-5 text-expense">
          {status.issue === 'unreadable'
            ? '.env 파일을 읽지 못했습니다. 파일 권한을 확인해 주세요.'
            : status.issue === 'invalid'
              ? '.env의 API 키 형식을 확인해 주세요.'
              : '프로젝트 .env에 NEXON_API_KEY를 입력해 주세요.'}
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-muted">
        키를 변경했다면 앱과 개발 서버를 종료한 뒤 다시 실행해 주세요.
      </p>
      <div className="mt-4">
        <Button
          variant="secondary"
          disabled={!status?.configured || busy}
          onClick={() => void test()}
        >
          {busy ? '연결 확인 중…' : 'API 연결 테스트'}
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-xs text-brand">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs leading-5 text-expense">
          {error}
        </p>
      )}
    </section>
  )
}
