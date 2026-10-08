import { useEffect, useId, useRef, useState } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type {
  NexonCharacter,
  NexonProfile,
  NexonBatchItem
} from '../../../shared/contracts/nexon.contract'
import { Button } from '../../components/ui/Button'
import { nexonApi } from './nexon.api'

interface Props {
  characters: Character[]
  busy: boolean
  onRegistered: () => Promise<void>
}
type Failure = Extract<NexonBatchItem, { status: 'failed' | 'notAttempted' }>
const identity = (row: { name: string; world: string }) =>
  JSON.stringify([
    row.name.normalize('NFC').trim().toLowerCase(),
    row.world.normalize('NFC').trim().toLowerCase()
  ])

export function NexonCharacterImport({ characters, busy, onRegistered }: Props) {
  const [rows, setRows] = useState<NexonCharacter[] | null>(null)
  const [profile, setProfile] = useState<NexonProfile | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [failures, setFailures] = useState<Failure[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState(false)
  const [registering, setRegistering] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const active = useRef(false)
  const lock = useRef(false)
  const id = useId()
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  // Keep immediate success feedback until a refreshed local list arrives.
  useEffect(() => {
    setCompleted(new Set())
  }, [characters])
  async function run(operation: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError('')
    setNotice('')
    try {
      await operation()
    } catch (caught) {
      if (active.current)
        setError(caught instanceof Error ? caught.message : '처리에 실패했습니다.')
    } finally {
      lock.current = false
      if (active.current) {
        setPending(false)
        setRegistering(0)
      }
    }
  }
  const registered = new Map(characters.map((row) => [identity(row), row]))
  const linked = new Map(characters.filter((row) => row.nexon).map((row) => [row.nexon!.ocid, row]))
  const isRegistered = (row: NexonCharacter) => completed.has(row.ocid) || linked.has(row.ocid)
  const disabled = busy || pending
  const matching =
    rows?.filter((row) =>
      `${row.name} ${row.world} ${row.job}`.toLowerCase().includes(filter.trim().toLowerCase())
    ) ?? []
  const eligible = matching.filter((row) => !isRegistered(row))
  const selectedRows = rows?.filter((row) => selected.has(row.ocid) && !isRegistered(row)) ?? []
  const selectedIds = new Set(selectedRows.map((row) => row.ocid))
  function toggle(ocid: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(ocid)
      else next.delete(ocid)
      return next
    })
  }
  async function registerSelection() {
    const selection = selectedRows.map((row) => row.ocid)
    if (!selection.length) return
    await run(async () => {
      setRegistering(selection.length)
      setFailures([])
      const result = await nexonApi.registerMany(selection)
      if (active.current) {
        const succeeded = result.items.filter(
          (item) => item.status === 'created' || item.status === 'existing'
        )
        const retry = result.items.filter(
          (item): item is Failure => item.status === 'failed' || item.status === 'notAttempted'
        )
        setCompleted((current) => new Set([...current, ...succeeded.map((item) => item.ocid)]))
        setSelected(new Set(retry.map((item) => item.ocid)))
        setFailures(retry)
        const created = result.items.filter((item) => item.status === 'created').length
        const existing = result.items.filter((item) => item.status === 'existing').length
        const failed = retry.filter((item) => item.status === 'failed').length
        const unattempted = retry.filter((item) => item.status === 'notAttempted').length
        setNotice(
          `일괄 등록 결과 · 신규 ${created}개 · 이미 등록 ${existing}개 · 실패 ${failed}개 · 미처리 ${unattempted}개`
        )
      }
      await onRegistered()
    })
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">넥슨에서 내 캐릭터 가져오기</h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            장부에 기록할 캐릭터를 체크한 뒤 한 번에 등록하세요.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() =>
            void run(async () => {
              const result = await nexonApi.list()
              if (active.current) {
                setRows(result)
                setProfile(null)
                setFailures([])
                setSelected(
                  (current) =>
                    new Set(result.filter((row) => current.has(row.ocid)).map((row) => row.ocid))
                )
              }
            })
          }
        >
          {pending && !registering ? '조회 중…' : '내 캐릭터 불러오기'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-xs leading-5 text-expense">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-xs leading-5 text-brand">
          {notice}
        </p>
      )}
      {registering > 0 && (
        <p role="status" className="mt-4 text-xs leading-5 text-brand">
          선택한 {registering}개 캐릭터를 등록하고 있습니다. 선택 수에 따라 시간이 걸릴 수 있습니다.
        </p>
      )}
      {failures.length > 0 && (
        <div className="mt-4 rounded-xl border border-expense/20 bg-expense/5 p-4">
          <p className="text-xs leading-5 text-expense">
            등록되지 않은 캐릭터는 체크 상태를 유지합니다. 오류를 확인한 뒤 다시 등록하세요.
          </p>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs leading-5 text-expense">
            {failures.map((item) => {
              const row = rows?.find((row) => row.ocid === item.ocid)
              return (
                <li key={item.ocid}>
                  {row ? `${row.name} · ${row.world}` : '선택한 캐릭터'} —{' '}
                  {item.status === 'notAttempted' ? '미처리' : '실패'}: {item.error.message}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {rows && (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label className="text-xs text-muted" htmlFor={`${id}-filter`}>
              캐릭터 검색 · 이름, 월드, 직업
            </label>
            <input
              id={`${id}-filter`}
              value={filter}
              disabled={disabled}
              onChange={(event) => setFilter(event.target.value)}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-brand disabled:opacity-50"
            />
            <p className="my-3 text-xs text-muted">
              전체 {rows.length}개 · 검색 결과 {matching.length}개 · 선택 {selectedRows.length}개
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={disabled || !eligible.length}
                onClick={() =>
                  setSelected(
                    (current) => new Set([...current, ...eligible.map((row) => row.ocid)])
                  )
                }
              >
                검색 결과 전체 선택
              </Button>
              <Button
                variant="secondary"
                disabled={disabled || !selectedRows.length}
                onClick={() => setSelected(new Set())}
              >
                선택 해제
              </Button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1" aria-label="넥슨 캐릭터 목록">
              {matching.map((row) => {
                const existing = linked.get(row.ocid) ?? registered.get(identity(row))
                const saved = isRegistered(row)
                const checkboxId = `${id}-${row.ocid}`
                return (
                  <div
                    key={row.ocid}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${selectedIds.has(row.ocid) ? 'border-brand bg-brand-soft' : 'border-line'}`}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      aria-label={`${row.name} 선택`}
                      checked={selectedIds.has(row.ocid)}
                      disabled={disabled || saved}
                      onChange={(event) => toggle(row.ocid, event.target.checked)}
                      className="size-4 shrink-0 accent-brand"
                    />
                    <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block break-words text-sm font-semibold">
                        {row.name} <span className="font-normal text-muted">· {row.world}</span>
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        Lv. {row.level} · {row.job}
                        {saved ? (existing?.isHidden ? ' · 등록됨 (숨김)' : ' · 이미 등록됨') : ''}
                        {!saved && existing ? ' · 기존 캐릭터에 API 연결' : ''}
                      </span>
                    </label>
                    <Button
                      variant="secondary"
                      className="shrink-0 px-3"
                      disabled={disabled}
                      aria-label={`${row.name} 기본 정보`}
                      onClick={() =>
                        void run(async () => {
                          setProfile(null)
                          const result = await nexonApi.basic(row.ocid)
                          if (active.current) setProfile(result)
                        })
                      }
                    >
                      정보
                    </Button>
                  </div>
                )
              })}
              {!matching.length && (
                <p className="py-5 text-xs text-muted">
                  {!rows.length
                    ? '조회 가능한 캐릭터가 없습니다. 계정과 정보 활용 동의를 확인해 주세요.'
                    : '검색 결과가 없습니다.'}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                disabled={disabled || !selectedRows.length}
                onClick={() => void registerSelection()}
              >
                {registering
                  ? `선택한 ${registering}개 등록 중…`
                  : `선택한 ${selectedRows.length}개 등록`}
              </Button>
              <span className="text-[11px] leading-5 text-muted">
                검색 조건을 바꿔도 체크한 캐릭터는 유지됩니다.
              </span>
            </div>
          </div>
          {profile ? (
            <div className="rounded-xl border border-line p-5">
              <h3 className="text-base font-semibold">{profile.name}</h3>
              <p className="mt-2 text-sm text-muted">
                {profile.world} · Lv. {profile.level} · {profile.job}
              </p>
              <p className="mt-3 text-xs text-muted">길드: {profile.guild || '없음'}</p>
              <p className="mt-2 text-[11px] text-muted">
                조회 시각:{' '}
                {new Date(profile.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
              </p>
              <p className="mt-4 text-xs leading-5 text-muted">
                등록할 캐릭터는 목록에서 체크하세요. 등록하면 API 정보를 저장하며, 이후 캐릭터
                카드에서 갱신할 수 있습니다.
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-canvas p-5 text-xs leading-5 text-muted">
              체크만 해도 등록할 수 있습니다. 자세한 내용을 보고 싶으면 캐릭터 옆의 정보 버튼을
              누르세요.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
