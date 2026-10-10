import { useEffect, useRef, useState } from 'react'
import { bossMonth, bossWeek, bossPeriodEnd, shiftDate } from '../../../shared/boss-period'
import { getKstDate } from '../../../shared/dates'
import type { BossBatchSyncResult } from '../../../shared/contracts/boss-sync.contract'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { bossesApi } from './bosses.api'

type Outcome = { label: string; result?: BossBatchSyncResult; error?: string }
export function BossSyncControl({
  date,
  month,
  disabled,
  onBusyChange,
  onChanged
}: {
  date: string
  month: string
  disabled: boolean
  onBusyChange: (busy: boolean) => void
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const lock = useRef(false),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function syncAll() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    onBusyChange(true)
    setOutcomes(null)
    const results: Outcome[] = []
    const today = getKstDate()
    try {
      for (const target of [
        { label: '주간', cycle: 'weekly' as const, date },
        { label: '월간', cycle: 'monthly' as const, date: month + '-01' }
      ]) {
        const start = target.cycle === 'weekly' ? bossWeek(target.date) : bossMonth(target.date)
        const current = target.cycle === 'weekly' ? bossWeek(today) : bossMonth(today)
        if (start > current || bossPeriodEnd(start, target.cycle) < shiftDate(today, -14)) {
          results.push({
            label: target.label,
            error:
              '선택한 기간은 API 조회 범위 밖입니다. 이번 주·이번 달을 선택해 주세요. 저장된 기록은 유지됩니다.'
          })
          continue
        }
        try {
          results.push({
            label: target.label,
            result: await bossesApi.syncClears(target.date, target.cycle)
          })
        } catch (error) {
          results.push({
            label: target.label,
            error: error instanceof Error ? error.message : 'API 기록 확인에 실패했습니다.'
          })
        }
      }
      if (mounted.current) {
        await onChanged()
        if (mounted.current) setOutcomes(results)
      }
    } finally {
      lock.current = false
      if (mounted.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }
  return (
    <>
      <Button disabled={disabled || busy} onClick={() => void syncAll()}>
        {busy ? 'API 기록 확인 중…' : 'API 클리어 일괄 확인'}
      </Button>
      {busy && (
        <p role="status" className="basis-full text-xs text-brand">
          등록된 캐릭터의 주간·월간 API 기록을 순서대로 확인하고 있습니다…
        </p>
      )}
      {outcomes && (
        <Dialog title="API 보스 기록 확인 결과" onClose={() => setOutcomes(null)}>
          <div className="space-y-4 text-xs leading-6">
            {outcomes.map(({ label, result, error }) => (
              <div key={label}>
                <p className="font-semibold">{label} 보스</p>
                {error ? (
                  <p role="alert" className="text-expense">
                    {error}
                  </p>
                ) : (
                  result && (
                    <>
                      <p>
                        확인 {result.items.filter((item) => item.status === 'synced').length}명 · 새
                        클리어 {result.items.reduce((sum, item) => sum + (item.applied ?? 0), 0)}개
                        · 실패 {result.items.filter((item) => item.status === 'failed').length}명 ·
                        미처리{' '}
                        {result.items.filter((item) => item.status === 'notAttempted').length}명 ·
                        API 미연결{' '}
                        {result.items.filter((item) => item.status === 'unlinked').length}명
                      </p>
                      {result.items
                        .filter((item) => item.error || item.removed)
                        .map((item) => (
                          <p
                            key={item.characterId}
                            className={item.error ? 'text-expense' : 'text-muted'}
                          >
                            {item.characterName} · {item.characterWorld}:{' '}
                            {item.error?.message ??
                              `빈 미클리어 기록 ${item.removed}개를 정리했습니다.`}
                          </p>
                        ))}
                    </>
                  )
                )}
              </div>
            ))}
            <p className="text-muted">
              조회에 성공한 기록은 진행도와 결정 수익에 반영했습니다. 주간·월간 기록 화면에서도
              갱신된 내용을 확인할 수 있습니다.
            </p>
            <p className="rounded-lg bg-brand-soft p-3 text-brand">
              새로 등록한 보스는 1인 클리어 기준입니다. 다인 파티로 클리어했다면 주간·월간 기록에서
              인원을 수정해 주세요. 기존 인원과 수동 수익은 유지됩니다.
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setOutcomes(null)}>확인</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
