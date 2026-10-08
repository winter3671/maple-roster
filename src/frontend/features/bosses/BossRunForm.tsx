import { useId, useState, type FormEvent } from 'react'
import {
  parseBossDetails,
  type BossRun,
  type BossRunUpdate
} from '../../../shared/contracts/boss.contract'
import { getKstDate } from '../../../shared/dates'
import {
  clampBossParty,
  defaultBossDifficulty,
  findWeeklyBoss,
  WEEKLY_BOSSES
} from '../../../shared/boss-catalog'
import { readText } from '../../../shared/validation'
import { parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { BossDetailsFields, bossFieldClass } from './BossPresetForm'

export function BossRunForm({
  run,
  busy,
  onSave,
  unavailable = [],
  onCancel
}: {
  run: BossRun
  busy: boolean
  onSave: (input: BossRunUpdate) => Promise<boolean>
  unavailable?: string[]
  onCancel: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState({
    bossName: run.bossName,
    difficulty: run.difficulty,
    partySize: String(run.partySize),
    notes: run.notes,
    incomeDate: run.settlement?.date ?? run.week
  })
  const [error, setError] = useState('')
  const [partyConfirmed, setPartyConfirmed] = useState(false)
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((current) =>
      key === 'bossName'
        ? {
            ...current,
            bossName: value,
            difficulty: defaultBossDifficulty(value),
            partySize: clampBossParty(value, defaultBossDifficulty(value), current.partySize)
          }
        : key === 'difficulty'
          ? {
              ...current,
              difficulty: value,
              partySize: clampBossParty(current.bossName, value, current.partySize)
            }
          : { ...current, [key]: value }
    )
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await onSave({
        id: run.id,
        bossName: draft.bossName,
        ...parseBossDetails({
          ...draft,
          partySize: parseDigits(draft.partySize)
        }),
        notes: readText(draft.notes, '메모', 500, false, true),
        confirmPartySize: partyConfirmed,
        ...(run.isCleared ? { incomeDate: draft.incomeDate } : {})
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm font-semibold">
        {run.characterName} · {run.characterWorld}
      </p>
      <label className="block text-xs font-semibold">
        보스
        <select
          aria-label="주차 보스"
          value={draft.bossName}
          required
          disabled={busy}
          className={bossFieldClass}
          onChange={(event) => change('bossName', event.target.value)}
        >
          <option value="" disabled>
            보스 선택
          </option>
          {run.bossName && !findWeeklyBoss(run.bossName) && (
            <option value={run.bossName}>{run.bossName} (기존 기록)</option>
          )}
          {WEEKLY_BOSSES.map((boss) => (
            <option
              key={boss.name}
              value={boss.name}
              disabled={unavailable.includes(boss.name) && boss.name !== run.bossName}
            >
              {boss.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-5 text-muted">
        {run.id ? '이 주차의 기록만 수정합니다.' : '선택한 캐릭터의 이 주차에 보스를 추가합니다.'}{' '}
        프리셋과 다른 주차에는 반영하지 않습니다.
      </p>
      <BossDetailsFields
        id={id}
        draft={draft}
        bossName={draft.bossName}
        legacyDifficulty={draft.bossName === run.bossName ? run.difficulty : undefined}
        legacyPartySize={draft.bossName === run.bossName ? run.partySize : undefined}
        preserveStoredPrice={draft.bossName === run.bossName && Boolean(run.id)}
        priceDate={run.week}
        storedPrice={draft.bossName === run.bossName && run.id ? run.crystalPrice : undefined}
        busy={busy}
        change={change}
      />
      <div>
        {run.partySizeNeedsReview && (
          <div className="mb-4 rounded-lg border border-expense/20 bg-expense/5 p-3 text-xs leading-5">
            <p>
              API에서 클리어 인원을 확인할 수 없어 임시 인원으로 수익을 반영했습니다. 다인
              파티였다면 인원을 변경하세요.
            </p>
            <label className="mt-2 flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={partyConfirmed}
                disabled={busy}
                onChange={(event) => setPartyConfirmed(event.target.checked)}
                className="accent-brand"
              />
              클리어 인원을 확인했습니다
            </label>
            <p className="mt-1 text-muted">
              확인 체크 또는 보스·난이도·인원 변경 후 저장하면 표시가 해제됩니다. 메모나 날짜만
              수정하면 유지됩니다.
            </p>
          </div>
        )}
        {run.isCleared && (
          <label className="mb-4 block text-xs font-semibold">
            수익 반영일
            <input
              aria-label="수익 반영일"
              type="date"
              value={draft.incomeDate}
              min={run.week}
              max={getKstDate()}
              required
              disabled={busy}
              className={bossFieldClass}
              onChange={(event) => change('incomeDate', event.target.value)}
            />
          </label>
        )}
        {run.isCleared && (
          <p className="mb-4 text-xs leading-5 text-muted">
            보스·난이도·인원을 수정하면 결정석 수익도 자동 갱신됩니다.
          </p>
        )}
        <label htmlFor={`${id}-notes`} className="text-xs font-semibold">
          보스 기록 메모
        </label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          value={draft.notes}
          onChange={(event) => change('notes', event.target.value)}
          maxLength={500}
          disabled={busy}
          className={bossFieldClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={busy}>
          {run.id ? '보스 기록 수정 저장' : '보스 추가 저장'}
        </Button>
      </div>
    </form>
  )
}
