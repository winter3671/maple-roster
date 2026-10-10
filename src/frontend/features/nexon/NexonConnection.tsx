import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { NexonStatus } from '../../../shared/contracts/nexon.contract'
import { Button } from '../../components/ui/Button'
import { nexonApi } from './nexon.api'

export function NexonConnection() {
  const [status, setStatus] = useState<NexonStatus>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [key, setKey] = useState('')
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
  async function changeKey(operation: () => Promise<NexonStatus>, message: string) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await operation()
      if (active.current) {
        setStatus(result)
        setMessage(message)
      }
    } catch (caught) {
      if (active.current)
        setError(caught instanceof Error ? caught.message : 'API 키 설정을 변경하지 못했습니다.')
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    const value = key
    setKey('')
    void changeKey(
      () => nexonApi.saveKey(value),
      'API 키를 암호화해 저장했습니다. 바로 사용할 수 있습니다. 연결 테스트로 유효성을 확인하세요.'
    )
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">넥슨 API 연결</h2>
        <span className="text-xs text-muted">
          {status
            ? status.configured
              ? status.keySource === 'saved'
                ? '암호화 키 사용 중'
                : '환경 파일(.env) 키 사용 중'
              : '키 설정 필요'
            : '확인 중'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        개인 API 키로 내 캐릭터 목록을 조회합니다. 캐릭터 관리에서 필요한 캐릭터를 선택해 장부에
        등록하세요.
      </p>
      {!status?.configured && status && (
        <p className="mt-3 text-xs leading-5 text-expense">
          {status.issue === 'unreadable'
            ? status.hasSavedKey
              ? '저장된 키를 읽지 못했습니다. 키를 다시 저장하거나 삭제해 주세요.'
              : '환경 파일(.env) 파일을 읽지 못했습니다. 설정에서 키를 저장할 수 있습니다.'
            : status.issue === 'invalid'
              ? '.env의 API 키 형식을 확인해 주세요.'
              : '아래에 발급받은 넥슨 API 키를 입력해 저장하세요.'}
        </p>
      )}
      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="block text-xs font-semibold" htmlFor="nexon-api-key">
          넥슨 API 키
        </label>
        <input
          id="nexon-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          maxLength={4096}
          required
          disabled={busy || !status?.encryptionAvailable}
          onChange={(event) => setKey(event.target.value)}
          placeholder={
            status?.hasSavedKey ? '변경할 새 키를 입력하세요' : '발급받은 API 키를 붙여넣으세요'
          }
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <p className="text-xs leading-5 text-muted">
          이 PC에 암호화해 보관합니다. 저장된 키는 다시 표시하지 않으며, 변경하면 재시작 없이 다음
          요청부터 적용됩니다.
        </p>
        {status && !status.encryptionAvailable && (
          <p className="text-xs leading-5 text-expense">
            이 환경에서 암호화 저장을 사용할 수 없습니다.
          </p>
        )}
        {status?.keySource === 'env' && (
          <p className="text-xs leading-5 text-muted">
            현재 환경 파일(.env) 키를 사용합니다. 설정에 저장한 키가 우선 적용됩니다.
          </p>
        )}
        {status?.hasSavedKey && (
          <p className="text-xs leading-5 text-muted">
            저장된 키를 삭제하면 환경 파일(.env) 키가 있는 경우 그 키로 돌아갑니다. 캐릭터와 장부는
            유지됩니다.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !status?.encryptionAvailable || !key.trim()}>
            API 키 저장
          </Button>
          <Button
            variant="danger"
            disabled={busy || !status?.hasSavedKey}
            onClick={() => {
              setKey('')
              void changeKey(nexonApi.removeKey, '앱에 저장된 API 키를 삭제했습니다.')
            }}
          >
            저장된 키 삭제
          </Button>
        </div>
      </form>
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
