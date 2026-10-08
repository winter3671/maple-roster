import { useEffect, useRef, useState } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type { NexonCharacter, NexonProfile } from '../../../shared/contracts/nexon.contract'
import { Button } from '../../components/ui/Button'
import { nexonApi } from './nexon.api'

interface Props {
  characters: Character[]
  busy: boolean
  onRegistered: () => Promise<void>
}

export function NexonCharacterImport({ characters, busy, onRegistered }: Props) {
  const [rows, setRows] = useState<NexonCharacter[] | null>(null)
  const [profile, setProfile] = useState<NexonProfile | null>(null)
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const active = useRef(false)
  const lock = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
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
        setError(caught instanceof Error ? caught.message : '조회에 실패했습니다.')
    } finally {
      lock.current = false
      if (active.current) setPending(false)
    }
  }
  const disabled = busy || pending
  const matching =
    rows?.filter((row) =>
      `${row.name} ${row.world} ${row.job}`.toLowerCase().includes(filter.trim().toLowerCase())
    ) ?? []
  const registered =
    profile &&
    characters.find(
      (row) =>
        row.name.toLowerCase() === profile.name.toLowerCase() &&
        row.world.toLowerCase() === profile.world.toLowerCase()
    )
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">넥슨에서 내 캐릭터 가져오기</h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            목록을 조회한 뒤 장부에 기록할 캐릭터를 선택하세요.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() =>
            void run(async () => {
              setProfile(null)
              setRows(null)
              const result = await nexonApi.list()
              if (active.current) setRows(result)
            })
          }
        >
          {pending ? '처리 중…' : '내 캐릭터 불러오기'}
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
      {rows && (
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <div>
            <label className="text-xs text-muted" htmlFor="nexon-character-filter">
              캐릭터 검색 · 이름, 월드, 직업
            </label>
            <input
              id="nexon-character-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-brand"
            />
            <p className="my-3 text-xs text-muted">
              전체 {rows.length}개 · 검색 결과 {matching.length}개
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-label="넥슨 캐릭터 목록">
              {matching.map((row) => (
                <button
                  key={row.ocid}
                  disabled={disabled}
                  aria-pressed={profile?.ocid === row.ocid}
                  onClick={() =>
                    void run(async () => {
                      setProfile(null)
                      const result = await nexonApi.basic(row.ocid)
                      if (active.current) setProfile(result)
                    })
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${profile?.ocid === row.ocid ? 'border-brand bg-brand-soft' : 'border-line hover:bg-canvas'}`}
                >
                  <span className="block text-sm font-semibold">
                    {row.name} <span className="font-normal text-muted">· {row.world}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    Lv. {row.level} · {row.job}
                  </span>
                </button>
              ))}
              {matching.length === 0 && (
                <p className="py-5 text-xs text-muted">
                  {rows.length === 0
                    ? '조회 가능한 캐릭터가 없습니다. 계정과 정보 활용 동의를 확인해 주세요.'
                    : '검색 결과가 없습니다.'}
                </p>
              )}
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
                이름과 월드를 장부에 등록합니다. 레벨·직업은 조회 정보이며, 자동 동기화는 후속
                단계입니다.
              </p>
              <div className="mt-5">
                <Button
                  disabled={disabled || Boolean(registered)}
                  onClick={() =>
                    void run(async () => {
                      const result = await nexonApi.register(profile.ocid)
                      if (!active.current) return
                      setNotice(
                        result.alreadyRegistered
                          ? '이미 등록된 캐릭터입니다. 기존 정보와 기록을 유지했습니다.'
                          : '캐릭터를 장부에 등록했습니다.'
                      )
                      await onRegistered()
                    })
                  }
                >
                  {registered
                    ? registered.isHidden
                      ? '등록됨 · 숨김 상태'
                      : '이미 등록됨'
                    : '이 캐릭터 등록'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-canvas p-5 text-xs leading-5 text-muted">
              목록에서 캐릭터를 선택하면 기본 정보를 확인할 수 있습니다.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
