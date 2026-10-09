import { useState } from 'react'
import type { DashboardStats } from '../../../shared/contracts/dashboard.contract'
import { formatMeso } from '../../lib/format'
import { MesoAmountHint } from '../../components/MesoAmountHint'

const sourceNames = { hunting: '사냥', crystal: '결정석', drop: '드랍 판매', manual: '직접 지출' }
export function DashboardBreakdown({
  data,
  onCharacter
}: {
  data: DashboardStats
  onCharacter: (id: string) => void
}) {
  const [selected, setSelected] = useState('')
  const point =
    data.trend.find((row) => row.period === selected) ??
    [...data.trend].reverse().find((row) => row.count > 0) ??
    data.trend[data.trend.length - 1]
  const maximum = data.trend.reduce((maximum, row) => Math.max(maximum, Math.abs(row.net)), 1)
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">
          {data.granularity === 'day' ? '일별' : '월별'} 순수익 추이
        </h2>
        <p className="mt-2 text-xs leading-6 text-muted">
          초록은 순수익, 빨강은 손실입니다. 막대를 눌러 수입·지출을 확인하세요. 62일 초과 기간은
          월별로 표시합니다.
        </p>
        <div className="mt-4 overflow-x-auto" aria-label="기간별 순수익 막대 그래프">
          <div className="flex gap-2 pb-2">
            {data.trend.map((row) => (
              <button
                key={row.period}
                type="button"
                aria-pressed={point?.period === row.period}
                aria-label={`${row.period} 순수익 ${row.net} 메소`}
                title={`${row.period}: ${formatMeso(row.net)} 메소`}
                onClick={() => setSelected(row.period)}
                className={`w-12 shrink-0 rounded-lg border p-1 text-center text-[10px] focus-visible:outline-brand ${point?.period === row.period ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-canvas'}`}
              >
                <span className="relative block h-32">
                  <span className="absolute inset-x-0 top-16 h-px bg-line" />
                  <span
                    className={`absolute inset-x-2 rounded-sm ${row.net > 0 ? 'bg-brand' : row.net < 0 ? 'bg-expense' : 'bg-line'}`}
                    style={{
                      height: row.net === 0 ? 1 : Math.max(2, (Math.abs(row.net) / maximum) * 58),
                      ...(row.net >= 0 ? { bottom: 64 } : { top: 64 })
                    }}
                  />
                </span>
                <span className="mt-2 block text-muted">
                  {data.granularity === 'day' ? row.period.slice(5) : row.period}
                </span>
              </button>
            ))}
          </div>
        </div>
        {point && (
          <p role="status" className="mt-3 text-xs leading-6 tabular-nums">
            {point.period} · 수입 {formatMeso(point.income)} · 지출 {formatMeso(point.expense)} ·{' '}
            <span className={point.net < 0 ? 'text-expense' : 'text-brand'}>
              순수익 {formatMeso(point.net)} 메소
            </span>{' '}
            · 거래 {point.count}건
          </p>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.sources.map((row) => (
          <article key={row.source} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold">{sourceNames[row.source]}</h2>
            <p
              className={`mb-1 mt-3 break-all text-lg font-semibold tabular-nums ${row.net < 0 ? 'text-expense' : 'text-brand'}`}
            >
              {formatMeso(row.net)} 메소
            </p>
            <MesoAmountHint value={row.net} />
            <p className="mt-3 text-[11px] leading-6 text-muted">
              수입 {formatMeso(row.income)} · 지출 {formatMeso(row.expense)} · {row.count}건
            </p>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-6 py-5 text-sm font-semibold">캐릭터별 수익</h2>
        {data.characters.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-canvas text-muted">
                <tr>
                  {['캐릭터 · 기록 서버', '수입', '지출', '순수익', '거래'].map((label) => (
                    <th key={label} scope="col" className="px-5 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.characters.map((row) => (
                  <tr key={row.characterId} className="border-t border-line">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <button
                            type="button"
                            onClick={() => onCharacter(row.characterId)}
                            className="rounded px-1 py-1 text-left font-semibold text-brand hover:bg-brand-soft focus-visible:outline-brand"
                          >
                            {row.name}
                          </button>
                          <p className="mt-1 text-muted">{row.worlds.join(' · ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{formatMeso(row.income)}</td>
                    <td className="px-5 py-3 tabular-nums">{formatMeso(row.expense)}</td>
                    <td
                      className={`px-5 py-3 font-semibold tabular-nums ${row.net < 0 ? 'text-expense' : 'text-brand'}`}
                    >
                      {formatMeso(row.net)}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{row.count}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-xs text-muted">조회 기간에 캐릭터별 거래가 없습니다.</p>
        )}
      </section>
    </div>
  )
}
