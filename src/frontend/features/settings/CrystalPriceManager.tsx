import { useRef, useState, type FormEvent } from 'react'
import { WEEKLY_BOSSES, defaultBossDifficulty, findWeeklyBoss } from '../../../shared/boss-catalog'
import { getKstDate } from '../../../shared/dates'
import { bossWeek } from '../../../shared/boss-period'
import type { CrystalPriceEntry } from '../../../shared/contracts/crystal-price.contract'
import { useCrystalPrices } from '../prices/CrystalPriceProvider'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { formatMeso, parseDigits } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { bossFieldClass } from '../bosses/BossPresetForm'

export function CrystalPriceManager() {
  const prices = useCrystalPrices()
  const [draft, setDraft] = useState({
    bossName: '스우',
    difficulty: '노멀',
    amount: '',
    effectiveOn: bossWeek(getKstDate()),
    checkedOn: getKstDate(),
    source: ''
  })
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [deleting, setDeleting] = useState<CrystalPriceEntry | null>(null)
  const lock = useRef(false)
  const history = prices.history.filter(
    (row) => row.bossName === draft.bossName && row.difficulty === draft.difficulty
  )
  const selected = prices.findPrice(draft.bossName, draft.difficulty, draft.effectiveOn)
  async function run(operation: () => Promise<CrystalPriceEntry[]>, message: string) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      prices.replace(await operation())
      setNotice(message)
      setDeleting(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '가격표를 저장하지 못했습니다.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const input = { ...draft, amount: parseDigits(draft.amount) }
      void run(
        () => unwrap(getBridge().prices.save(input)),
        '가격표를 저장했습니다. 기존 보스 기록의 가격·수익은 유지됩니다.'
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '가격을 확인해 주세요.')
    }
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">결정석 가격표 관리</h2>
      <p className="mt-3 text-xs leading-6 text-muted">
        보스·난이도별 1인 기준 가격을 적용일, 확인일, 출처와 함께 등록합니다. 해당 날짜 이하의 가장
        최근 가격을 사용하고, 같은 적용일에는 수동 가격을 우선합니다. 공식 가격을 자동 조회하는
        기능은 아닙니다.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        프리셋은 오늘, 새 주간 기록은 목요일 주차 시작일 기준입니다. 저장·삭제는 기존 기록의 가격과
        수익을 바꾸지 않습니다.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold">
            가격표 보스
            <select
              aria-label="가격표 보스"
              className={bossFieldClass}
              disabled={busy}
              value={draft.bossName}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  bossName: event.target.value,
                  difficulty: defaultBossDifficulty(event.target.value),
                  amount: '',
                  source: ''
                })
              }
            >
              {WEEKLY_BOSSES.map((boss) => (
                <option key={boss.name}>{boss.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            가격표 난이도
            <select
              aria-label="가격표 난이도"
              className={bossFieldClass}
              disabled={busy}
              value={draft.difficulty}
              onChange={(event) =>
                setDraft({ ...draft, difficulty: event.target.value, amount: '', source: '' })
              }
            >
              {findWeeklyBoss(draft.bossName)?.difficulties.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            가격 적용일
            <input
              aria-label="가격 적용일"
              type="date"
              required
              className={bossFieldClass}
              disabled={busy}
              value={draft.effectiveOn}
              onChange={(event) => setDraft({ ...draft, effectiveOn: event.target.value })}
            />
          </label>
          <label className="text-xs font-semibold">
            가격 확인일
            <input
              aria-label="가격 확인일"
              type="date"
              required
              max={getKstDate()}
              className={bossFieldClass}
              disabled={busy}
              value={draft.checkedOn}
              onChange={(event) => setDraft({ ...draft, checkedOn: event.target.value })}
            />
          </label>
          <label className="text-xs font-semibold">
            1인 결정석 가격
            <input
              aria-label="가격표 1인 결정석 가격"
              inputMode="numeric"
              required
              className={bossFieldClass}
              disabled={busy}
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </label>
          <label className="text-xs font-semibold">
            가격 출처
            <input
              aria-label="가격 출처"
              required
              maxLength={300}
              placeholder="공지 URL 또는 직접 확인한 위치"
              className={bossFieldClass}
              disabled={busy}
              value={draft.source}
              onChange={(event) => setDraft({ ...draft, source: event.target.value })}
            />
          </label>
        </div>
        <p className="text-xs leading-6 text-muted">
          선택한 적용일의 가격:{' '}
          {selected
            ? `${formatMeso(selected.amount)} 메소 · 적용 ${selected.effectiveOn} · 확인 ${selected.checkedOn} · ${selected.isCustom ? '수동 등록' : '앱 기본 가격표'}`
            : '지원 가격 없음'}
        </p>
        <p className="text-xs text-muted">
          같은 보스·난이도·적용일을 다시 저장하면 해당 수동 가격을 교체합니다. 다른 적용일로
          저장하면 이력이 추가됩니다.
        </p>
        <Button type="submit" disabled={busy}>
          가격표 저장
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-xs text-brand">
          {notice}
        </p>
      )}
      <h3 className="mt-6 text-xs font-semibold">
        {draft.bossName} · {draft.difficulty} 가격 이력
      </h3>
      <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="bg-canvas text-muted">
            <tr>
              {['적용일', '1인 가격', '확인일 · 출처', '구분 · 관리'].map((label) => (
                <th key={label} scope="col" className="p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3">{row.effectiveOn}</td>
                <td className="p-3 tabular-nums">{formatMeso(row.amount)}</td>
                <td className="max-w-80 break-all p-3">
                  {row.checkedOn}
                  <br />
                  {row.source}
                </td>
                <td className="p-3">
                  <p className="mb-2">{row.isCustom ? '수동 등록' : '앱 기본'}</p>
                  {row.isCustom && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          setDraft({
                            bossName: row.bossName,
                            difficulty: row.difficulty,
                            amount: String(row.amount),
                            effectiveOn: row.effectiveOn,
                            checkedOn: row.checkedOn,
                            source: row.source
                          })
                        }
                      >
                        불러오기
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => setDeleting(row)}>
                        삭제
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleting && (
        <Dialog title="수동 가격표 삭제" busy={busy} onClose={() => setDeleting(null)}>
          <p className="text-sm leading-6">
            {deleting.bossName} · {deleting.difficulty} · {deleting.effectiveOn}의 수동 가격을
            삭제합니다. 이후 새 기록에는 남은 이력 중 해당 날짜의 가격이 적용되며 기존 보스 기록은
            유지됩니다.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run(
                  () => unwrap(getBridge().prices.remove(deleting.id)),
                  '수동 가격표를 삭제했습니다. 기존 기록은 유지됩니다.'
                )
              }
            >
              수동 가격표 삭제
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
