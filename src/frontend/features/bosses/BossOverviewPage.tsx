import { useMemo, useState } from 'react'
import { bossMonth, bossWeek, bossPeriodEnd } from '../../../shared/boss-period'
import { getKstDate } from '../../../shared/dates'
import { Button } from '../../components/ui/Button'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { formatMeso } from '../../lib/format'
import { useBosses } from './useBosses'
import { BossSyncControl } from './BossSyncControl'

export function BossOverviewPage({
  onSyncBusyChange
}: {
  onSyncBusyChange: (busy: boolean) => void
}) {
  const [syncBusy, setSyncBusy] = useState(false)
  const [date, setDate] = useState(getKstDate)
  const [month, setMonth] = useState(() => getKstDate().slice(0, 7))
  const [characterId, setCharacterId] = useState('')
  const weeklyQuery = useMemo(
    () => ({ date, characterId, cycle: 'weekly' as const }),
    [date, characterId]
  )
  const monthlyQuery = useMemo(
    () => ({ date: `${month}-01`, characterId, cycle: 'monthly' as const }),
    [month, characterId]
  )
  const weekly = useBosses(weeklyQuery),
    monthly = useBosses(monthlyQuery)
  const w = weekly.data?.summary,
    m = monthly.data?.summary
  const ready = Boolean(w && m)
  const remaining = ready ? w!.remaining + m!.remaining : undefined
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-surface p-5">
        <label className="text-xs text-muted">
          주간 보스 기준일
          <input
            type="date"
            disabled={syncBusy}
            aria-label="주간 보스 기준일"
            min="2000-01-06"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value)
            }}
            className="mt-2 block rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="text-xs text-muted">
          월간 보스 기준월
          <input
            type="month"
            disabled={syncBusy}
            aria-label="월간 보스 기준월"
            min="2000-02"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value)
            }}
            className="mt-2 block rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="text-xs text-muted">
          캐릭터
          <select
            aria-label="정산 캐릭터"
            disabled={syncBusy}
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="mt-2 block rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">전체 캐릭터</option>
            {weekly.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.world}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={syncBusy}
          onClick={() => {
            setDate(getKstDate())
            setMonth(getKstDate().slice(0, 7))
          }}
        >
          이번 주·이번 달
        </Button>
        <BossSyncControl
          date={date}
          month={month}
          disabled={
            weekly.loading || monthly.loading || !weekly.characters.some((row) => row.nexon)
          }
          onBusyChange={(busy) => {
            setSyncBusy(busy)
            onSyncBusyChange(busy)
          }}
          onChanged={async () => {
            await Promise.all([weekly.reload(), monthly.reload()])
          }}
        />
        <p className="basis-full text-xs leading-6 text-muted">
          주간 {bossWeek(date)} ~ {bossPeriodEnd(date)} · 월간 {bossMonth(`${month}-01`)} ~{' '}
          {bossPeriodEnd(`${month}-01`, 'monthly')} · 캐릭터 필터와 관계없이 등록된 모든 API
          캐릭터를 확인합니다.
        </p>
      </section>
      {(weekly.error || monthly.error) && (
        <p role="alert" className="text-xs text-expense">
          {weekly.error || monthly.error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">클리어 진행</p>
          <p className="mt-4 text-lg font-semibold text-brand">
            주간 {w ? `${w.cleared} / ${w.count}` : '—'}
          </p>
          <p className="mt-2 text-sm text-muted">월간 {m ? `${m.cleared} / ${m.count}` : '—'}</p>
          <p className="mt-3 text-xs text-muted">
            장부에 등록된 보스 기준 · 클리어 체크 시 결정 수익 반영
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">남은 보스 예상 수익</p>
          <p className="mt-4 text-lg font-semibold text-brand">
            {remaining === undefined ? '—' : `${formatMeso(remaining)} 메소`}
          </p>
          {remaining !== undefined && <MesoAmountHint value={remaining} />}
          <p className="mt-3 text-xs leading-6 text-muted">
            주간 {w ? formatMeso(w.remaining) : '—'} · 월간 {m ? formatMeso(m.remaining) : '—'} 메소
          </p>
        </article>
        {[
          {
            title: '이 주차 결정 수익',
            amount: w?.settled
          },
          {
            title: '이달 결정 수익',
            amount: m?.settled
          }
        ].map((card) => (
          <article key={card.title} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-muted">{card.title}</p>
            <p className="mt-4 text-lg font-semibold text-brand">
              {card.amount === undefined ? '—' : `${formatMeso(card.amount)} 메소`}
            </p>
            {card.amount !== undefined && <MesoAmountHint value={card.amount} />}
            <p className="mt-3 text-xs text-muted">
              선택한 기간의 클리어 기록 기준 · 드랍 수익 별도
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
