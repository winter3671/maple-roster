import { useState, type FormEvent } from 'react'
import type { BossIncomeDateUpdate, BossRun } from '../../../shared/contracts/boss.contract'
import { getKstDate, readDate } from '../../../shared/dates'
import { formatMeso } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { bossFieldClass } from './BossPresetForm'

export function BossIncomeDateForm({
  run,
  busy,
  onSave,
  onCancel
}: {
  run: BossRun
  busy: boolean
  onSave: (input: BossIncomeDateUpdate) => Promise<boolean>
  onCancel: () => void
}) {
  const [date, setDate] = useState(run.settlement?.date ?? run.week),
    [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (!run.settlement) throw new Error('수익이 반영된 기록을 선택해 주세요.')
      await onSave({ id: run.id, date: readDate(date), expectedDate: run.settlement.date })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '날짜를 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm font-semibold">
        {run.characterName} · {run.bossName} · {run.difficulty}
      </p>
      <p className="text-xs leading-6 text-muted">
        수익 {formatMeso(run.settlement?.amount ?? 0)} 메소의 장부 반영일만 변경합니다.
        보스·인원·금액·인원 확인 상태는 유지하며 거래 내역과 대시보드의 날짜별 합계에 적용됩니다.
      </p>
      <label className="block text-xs font-semibold">
        수익 반영일
        <input
          aria-label="수익 반영일"
          type="date"
          required
          min={run.week}
          max={getKstDate()}
          disabled={busy}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={bossFieldClass}
        />
      </label>
      <p className="text-xs leading-6 text-muted">
        API 자동 확인은 실제 처치일을 기록하지 않습니다. 새 수익의 기본 반영일은 이번 주에는 조회일,
        과거 주에는 주차 시작일입니다. 필요하면 실제 수익을 반영할 날짜로 조정하세요. 보스의 소속
        주차는 바뀌지 않습니다.
      </p>
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
          반영일 저장
        </Button>
      </div>
    </form>
  )
}
