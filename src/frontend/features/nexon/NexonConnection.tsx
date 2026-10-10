import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { NexonStatus } from '../../../shared/contracts/nexon.contract'
import { Button } from '../../components/ui/Button'
import { nexonApi } from './nexon.api'
import { NexonKeyGuide } from './NexonKeyGuide'

const field = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm'
export function NexonConnection() {
  const [status, setStatus] = useState<NexonStatus>()
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [showKeyGuide, setShowKeyGuide] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null)
  const active = useRef(false)
  const pending = useRef(false)
  const accounts = status?.accounts ?? []
  const selected = accounts.find((row) => row.id === status?.activeAccountId)
  const currentName =
    selected?.label ?? (status?.keySource === 'env' ? '환경 파일(.env) 계정' : '선택된 계정 없음')
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
    setTesting(true)
    setError('')
    setMessage('')
    try {
      const rows = await nexonApi.list()
      if (active.current)
        setMessage(`${currentName} 연결 성공 · 조회 가능한 캐릭터 ${rows.length}개`)
    } catch (caught) {
      if (active.current)
        setError(caught instanceof Error ? caught.message : '연결에 실패했습니다.')
    } finally {
      pending.current = false
      if (active.current) {
        setBusy(false)
        setTesting(false)
      }
    }
  }
  async function changeKey(
    operation: () => Promise<NexonStatus>,
    message: string
  ): Promise<boolean> {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await operation()
      if (active.current) {
        setStatus(result)
        setMessage(message)
        setRenaming(null)
        setDeleting(null)
      }
      return true
    } catch (caught) {
      if (active.current)
        setError(caught instanceof Error ? caught.message : 'API 계정을 변경하지 못했습니다.')
      return false
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    const input = { label, key }
    const name = label.trim()
    setKey('')
    if (
      await changeKey(
        () => nexonApi.saveKey(input),
        `${name} 계정을 등록했습니다. 사용할 계정은 목록에서 선택하세요.`
      )
    )
      setLabel('')
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">넥슨 API 연결</h2>
      <p className="mt-3 text-xs leading-6 text-muted">
        계정마다 이름과 API 키를 등록하세요. 현재 선택한 계정의 키로 캐릭터 목록과 API 기록을
        조회합니다.
      </p>
      <div className="mt-4 rounded-xl bg-brand-soft p-4 text-sm">
        <p className="font-semibold text-brand">
          현재 사용 계정: {status ? currentName : '확인 중'}
        </p>
        <p className="mt-2 text-xs text-muted">
          {status?.configured
            ? '선택한 키를 다음 API 요청부터 사용합니다.'
            : 'API 키를 등록하거나 사용할 계정을 선택해 주세요.'}
        </p>
      </div>
      {status?.issue === 'unreadable' && status.hasSavedKey && (
        <div className="mt-4 space-y-3 text-xs text-expense">
          <p>
            저장된 API 계정을 읽지 못했습니다. 기존 설정을 삭제한 뒤 키를 다시 등록해 주세요.
            캐릭터와 장부는 유지됩니다.
          </p>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              void changeKey(() => nexonApi.removeKey(), '읽을 수 없는 API 설정을 삭제했습니다.')
            }
          >
            손상된 API 설정 삭제
          </Button>
        </div>
      )}
      {status?.issue === 'invalid' && (
        <p className="mt-3 text-xs text-expense">환경 파일(.env)의 API 키 형식을 확인해 주세요.</p>
      )}
      <form onSubmit={(event) => void save(event)} className="mt-5 space-y-3">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <div className="mb-2 flex items-center gap-2">
              <label className="text-xs font-semibold" htmlFor="nexon-api-key">
                넥슨 API 키
              </label>
              <button
                type="button"
                aria-label="넥슨 API 키 발급 가이드"
                aria-haspopup="dialog"
                title="API 키 발급 방법 보기"
                onClick={() => setShowKeyGuide(true)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs font-semibold text-muted hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                ?
              </button>
            </div>
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
              placeholder="발급받은 API 키를 붙여넣으세요"
              className={field}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-2 block text-xs font-semibold" htmlFor="nexon-account-label">
              계정 이름 (최대 15자)
            </label>
            <input
              id="nexon-account-label"
              value={label}
              required
              maxLength={15}
              disabled={busy || !status?.encryptionAvailable}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="예: 본계정, 부계정1"
              className={field}
            />
          </div>
        </div>
        <p className="text-xs leading-5 text-muted">
          API 키는 이 PC에 암호화해 보관하며 다시 표시하지 않습니다. 계정을 추가해도 현재 사용
          계정은 유지됩니다. 첫 계정은 자동으로 선택합니다.
        </p>
        {status && !status.encryptionAvailable && (
          <p className="text-xs text-expense">이 환경에서 암호화 저장을 사용할 수 없습니다.</p>
        )}
        <Button
          type="submit"
          disabled={busy || !status?.encryptionAvailable || !key.trim() || !label.trim()}
        >
          API 계정 등록
        </Button>
      </form>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-xs font-semibold">
          등록된 API 계정 <span className="ml-1 text-brand">{accounts.length}</span>
        </h3>
        {accounts.length ? (
          <ul className="mt-3 divide-y divide-line">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <span className="break-all text-sm font-medium">{account.label}</span>
                  {account.id === status?.activeAccountId && (
                    <span className="ml-3 rounded-full bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand">
                      사용 중
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {account.id !== status?.activeAccountId && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void changeKey(
                          () => nexonApi.activateKey(account.id),
                          `${account.label} 계정으로 변경했습니다.`
                        )
                      }
                    >
                      사용
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setRenaming(account)
                      setDeleting(null)
                      setError('')
                      setMessage('')
                    }}
                  >
                    이름 변경
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(account)
                      setRenaming(null)
                      setError('')
                      setMessage('')
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted">등록된 API 계정이 없습니다.</p>
        )}
        {renaming && (
          <form
            className="mt-4 space-y-3 rounded-xl bg-canvas p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void changeKey(
                () => nexonApi.renameKey(renaming.id, renaming.label),
                '계정 이름을 변경했습니다.'
              )
            }}
          >
            <label className="block text-xs font-semibold" htmlFor="nexon-rename-label">
              새 계정 이름 (최대 15자)
            </label>
            <input
              id="nexon-rename-label"
              required
              maxLength={15}
              disabled={busy}
              value={renaming.label}
              onChange={(event) => setRenaming({ ...renaming, label: event.target.value })}
              className={field}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                이름 저장
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setRenaming(null)}>
                취소
              </Button>
            </div>
          </form>
        )}
        {deleting && (
          <div className="mt-4 space-y-3 rounded-xl border border-expense/30 p-4">
            <p className="text-xs leading-6">
              {deleting.label} 계정의 API 키를 삭제할까요? 캐릭터와 장부는 유지됩니다. 사용 중인
              계정을 삭제하면 남은 첫 계정으로 전환하고, 등록 계정이 없으면 환경 파일(.env) 키가
              있는 경우 그 키를 사용합니다.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void changeKey(() => nexonApi.removeKey(deleting.id), 'API 계정을 삭제했습니다.')
                }
              >
                계정 삭제 확인
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
                취소
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 space-y-2">
        <Button
          variant="secondary"
          disabled={!status?.configured || busy}
          onClick={() => void test()}
        >
          {testing ? '연결 확인 중…' : '현재 계정 연결 확인'}
        </Button>
        <p className="text-[11px] leading-5 text-muted">
          실제 캐릭터 목록을 조회하여 키의 유효성과 조회 권한을 확인합니다. 캐릭터는 장부에 자동
          등록하지 않습니다.
        </p>
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
      {showKeyGuide && <NexonKeyGuide onClose={() => setShowKeyGuide(false)} />}
    </section>
  )
}
