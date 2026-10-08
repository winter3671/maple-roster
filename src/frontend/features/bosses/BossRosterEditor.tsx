import { useState, type FormEvent } from 'react'
import type { BossMember } from '../../../shared/contracts/boss-roster.contract'
import { MAX_ROSTER_BOSSES, parseBossMembers } from '../../../shared/contracts/boss-roster.contract'
import {
  WEEKLY_BOSSES,
  findWeeklyBoss,
  defaultBossDifficulty,
  bossPartyLimit,
  clampBossParty
} from '../../../shared/boss-catalog'
import { crystalShare, findCrystalPrice } from '../../../shared/crystal-prices'
import { getKstDate } from '../../../shared/dates'
import { Button } from '../../components/ui/Button'
import { formatMeso } from '../../lib/format'
import { bossFieldClass } from './BossPresetForm'

export function BossRosterEditor({
  initial = [],
  initialName = '',
  named = true,
  busy,
  onSave,
  onCancel
}: {
  initial?: BossMember[]
  initialName?: string
  named?: boolean
  busy: boolean
  onSave: (members: BossMember[], name: string) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [rows, setRows] = useState(() => initial.map((member) => ({ ...member })))
  const [error, setError] = useState('')
  const total = rows.reduce(
    (sum, row) =>
      sum +
      crystalShare(
        findCrystalPrice(row.bossName, row.difficulty, getKstDate())?.amount ?? 0,
        row.partySize
      ),
    0
  )
  function update(index: number, key: keyof BossMember, value: string) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row
        const next =
          key === 'bossName'
            ? { ...row, bossName: value, difficulty: defaultBossDifficulty(value) }
            : key === 'partySize'
              ? { ...row, partySize: Number(value) }
              : { ...row, difficulty: value }
        next.partySize = Number(
          clampBossParty(next.bossName, next.difficulty, String(next.partySize))
        )
        return next
      })
    )
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave(parseBossMembers(rows), name.trim())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {named && (
        <label className="block text-xs font-semibold">
          프리셋 이름
          <input
            aria-label="프리셋 이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={50}
            disabled={busy}
            className={bossFieldClass}
            placeholder="예: 익세노흉"
          />
        </label>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          보스 구성 {rows.length} / {MAX_ROSTER_BOSSES}
        </p>
        <Button
          variant="secondary"
          disabled={busy || rows.length >= MAX_ROSTER_BOSSES}
          onClick={() => setRows([...rows, { bossName: '', difficulty: '', partySize: 1 }])}
        >
          보스 추가
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted">
        1~12개를 묶을 수 있습니다. 같은 보스는 한 번만 넣고 난이도와 클리어 인원을 선택하세요.
      </p>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const boss = findWeeklyBoss(row.bossName)
          const old = initial.find((entry) => entry.bossName === row.bossName)
          const maximum = bossPartyLimit(row.bossName, row.difficulty)
          const legacyParty =
            old?.difficulty === row.difficulty && old.partySize > maximum
              ? old.partySize
              : undefined
          const amount = findCrystalPrice(row.bossName, row.difficulty, getKstDate())?.amount
          return (
            <div key={index} className="rounded-xl border border-line p-3">
              <div className="grid grid-cols-[1fr_100px_85px_auto] items-end gap-2">
                <label className="text-xs">
                  보스 {index + 1}
                  <select
                    aria-label={`보스 ${index + 1}`}
                    value={row.bossName}
                    disabled={busy}
                    required
                    className={bossFieldClass}
                    onChange={(event) => update(index, 'bossName', event.target.value)}
                  >
                    <option value="" disabled>
                      보스 선택
                    </option>
                    {row.bossName && !boss && (
                      <option value={row.bossName}>{row.bossName} (기존 기록)</option>
                    )}
                    {WEEKLY_BOSSES.map((item) => (
                      <option
                        key={item.name}
                        value={item.name}
                        disabled={rows.some(
                          (entry, i) => i !== index && entry.bossName === item.name
                        )}
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  난이도
                  <select
                    aria-label={`난이도 ${index + 1}`}
                    required
                    value={row.difficulty}
                    disabled={busy || !row.bossName}
                    className={bossFieldClass}
                    onChange={(event) => update(index, 'difficulty', event.target.value)}
                  >
                    <option value="" disabled>
                      선택
                    </option>
                    {row.difficulty && !boss?.difficulties.includes(row.difficulty) && (
                      <option value={row.difficulty}>{row.difficulty} (기존)</option>
                    )}
                    {boss?.difficulties.map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  인원
                  <select
                    aria-label={`인원 ${index + 1}`}
                    value={row.partySize}
                    disabled={busy || !row.difficulty}
                    className={bossFieldClass}
                    onChange={(event) => update(index, 'partySize', event.target.value)}
                  >
                    {Array.from({ length: maximum }, (_, i) => i + 1).map((count) => (
                      <option key={count} value={count}>
                        {count}명
                      </option>
                    ))}
                    {legacyParty && <option value={legacyParty}>{legacyParty}명 (기존)</option>}
                  </select>
                </label>
                <Button
                  variant="secondary"
                  disabled={busy}
                  aria-label={`보스 ${index + 1} 제거`}
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                >
                  제거
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                최대 {maximum}명 · 예상 내 몫{' '}
                {amount === undefined
                  ? '가격표 없음'
                  : `${formatMeso(crystalShare(amount, row.partySize))} 메소`}
              </p>
            </div>
          )
        })}
      </div>
      <p className="rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand">
        현재 가격표 기준 예상 합계 {formatMeso(total)} 메소
      </p>
      {!named && (
        <p className="text-xs leading-5 text-muted">
          이 캐릭터의 다음 주차 생성에 적용합니다. 공용 프리셋·다른 캐릭터·이미 생성한 주차는 그대로
          유지됩니다.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button type="submit" disabled={busy || !rows.length || rows.length > 12}>
          {busy ? '저장 중…' : '구성 저장'}
        </Button>
      </div>
    </form>
  )
}
