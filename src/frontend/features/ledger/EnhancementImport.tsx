import { useRef, useState, type FormEvent } from 'react'
import type { EnhancementPreview } from '../../../shared/contracts/enhancement.contract'
import { getKstDate } from '../../../shared/dates'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { MesoAmountHint } from '../../components/MesoAmountHint'
import { useFormProtection, useInputProtection } from '../../components/InputProtection'
import { useTaskNotifications } from '../../components/TaskNotifications'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { formatMeso, parseDigits } from '../../lib/format'
import { notifyDataChanged, useStartupSyncRunning } from '../../lib/data-sync-state'

const field =
  'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs disabled:opacity-50'
export function EnhancementImport({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(getKstDate)
  const [preview, setPreview] = useState<EnhancementPreview>()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const pending = useRef(false)
  const startup = useStartupSyncRunning(),
    tasks = useTaskNotifications(),
    { request } = useInputProtection()
  async function query() {
    if (pending.current || startup) return
    pending.current = true
    setBusy(true)
    setError('')
    setPreview(undefined)
    const task = tasks.begin('강화 지출 이력 조회')
    try {
      const result = await unwrap(getBridge().ledger.previewEnhancements({ date }))
      setPreview(result)
      task.finish(
        'success',
        `새 항목 ${result.rows.length}건 · 이미 반영한 이력 ${result.alreadyImported}회`
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '강화 이력을 가져오지 못했습니다.')
      task.finish('error', '조회에 실패했습니다. API 계정과 날짜를 확인하고 다시 시도해 주세요.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog title="강화 지출 가져오기" wide busy={busy} onClose={onClose}>
      <div className="space-y-4 text-xs leading-6">
        <p className="text-muted">
          현재 선택한 API 계정의 메소 잠재능력·에디셔널 재설정 이력을 가져옵니다. 스타포스와 큐브
          사용 내역은 이번 가져오기 대상에 포함하지 않습니다.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            조회 날짜
            <input
              aria-label="강화 조회 날짜"
              className={field}
              type="date"
              value={date}
              max={getKstDate()}
              required
              disabled={busy}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || startup || !date}
            onClick={() => request(() => void query(), undefined, 'discard')}
          >
            {busy ? '처리 중…' : '강화 이력 조회'}
          </Button>
        </div>
        <p className="text-muted">
          이력 반영은 최대 30분 지연될 수 있습니다. 조회만으로 지출을 저장하지 않습니다.
        </p>
        {error && (
          <p role="alert" className="text-expense">
            {error}
          </p>
        )}
        {preview && (
          <>
            <p className="rounded-lg bg-canvas p-3">
              {preview.accountLabel} · {preview.date}
              <br />
              이미 반영 {formatMeso(preview.alreadyImported)}회 · 등록 캐릭터 불일치·지원하지 않는
              유형 제외 {formatMeso(preview.excluded)}회
            </p>
            {preview.rows.length ? (
              <Results
                key={preview.id}
                preview={preview}
                busy={busy}
                setBusy={setBusy}
                onClose={onClose}
              />
            ) : (
              <p role="status">반영할 새 메소 재설정 이력이 없습니다.</p>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
function Results({
  preview,
  busy,
  setBusy,
  onClose
}: {
  preview: EnhancementPreview
  busy: boolean
  setBusy: (value: boolean) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState(() =>
    preview.rows.map((row) => ({
      id: row.id,
      selected: row.amount !== null && !!row.characterId,
      characterId: row.characterId ?? '',
      amount: row.amount === null ? '' : String(row.amount)
    }))
  )
  const [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState('')
  const protection = useFormProtection({ rows, confirmed }, busy)
  const pending = useRef(false),
    tasks = useTaskNotifications()
  const selected = rows.filter((row) => row.selected)
  const total = selected.reduce((sum, row) => sum + parseDigits(row.amount), 0)
  const valid =
    selected.length > 0 &&
    Number.isSafeInteger(total) &&
    selected.every(
      (row) =>
        row.characterId &&
        Number.isSafeInteger(parseDigits(row.amount)) &&
        parseDigits(row.amount) > 0
    )
  function change(id: string, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (pending.current || !valid || !confirmed) return
    pending.current = true
    setBusy(true)
    setError('')
    const task = tasks.begin('강화 지출 반영')
    try {
      await protection.save(async () => {
        const result = await unwrap(
          getBridge().ledger.applyEnhancements({
            previewId: preview.id,
            confirmed,
            rows: selected.map(({ id, characterId, amount }) => ({
              id,
              characterId,
              amount: parseDigits(amount)
            }))
          })
        )
        notifyDataChanged()
        task.finish(
          'success',
          `${result.records}회 이력을 ${result.expenses}건의 강화 지출로 반영했습니다. 총 ${formatMeso(result.amount)} 메소`
        )
        onClose()
        return true
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '강화 지출을 반영하지 못했습니다.')
      task.finish('error', '지출을 반영하지 못했습니다. 오류 안내를 확인해 주세요.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form {...protection.formProps} onSubmit={(event) => void save(event)} className="space-y-4">
      <p className="rounded-lg border border-line bg-brand-soft p-3">
        표시 금액은 공식 기본 비용표로 계산한 값입니다. 할인·이벤트 등으로 실제 비용이 다르면 총액을
        수정하세요. 기존에 수동으로 기록한 지출과 중복되는 항목은 선택을 해제해 주세요.
      </p>
      {preview.rows.map((source, index) => {
        const row = rows[index]
        return (
          <fieldset
            key={source.id}
            disabled={busy}
            className="space-y-3 rounded-xl border border-line p-4"
          >
            <label className="flex gap-2 font-semibold">
              <input
                type="checkbox"
                aria-label={`${source.characterName} ${source.kind} 반영`}
                checked={row.selected}
                onChange={(event) => change(row.id, { selected: event.target.checked })}
              />
              {source.characterName} · {source.kind} {formatMeso(source.count)}회
            </label>
            <p className="break-words text-muted">
              장비: {source.items.join(', ')}
              {source.items.length === 8 ? ' 외' : ''}
            </p>
            {source.warning && <p className="text-expense">{source.warning}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                기록할 캐릭터
                <select
                  aria-label={`${source.characterName} ${source.kind} 캐릭터`}
                  className={field}
                  value={row.characterId}
                  onChange={(event) => change(row.id, { characterId: event.target.value })}
                >
                  <option value="">캐릭터 선택</option>
                  {preview.characters
                    .filter(
                      (c) => c.name.normalize('NFC') === source.characterName.normalize('NFC')
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.world} · {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                확인한 지출 총액 (메소)
                <input
                  aria-label={`${source.characterName} ${source.kind} 지출 총액`}
                  className={field}
                  inputMode="numeric"
                  maxLength={25}
                  value={row.amount}
                  onChange={(event) => change(row.id, { amount: event.target.value })}
                />
                <MesoAmountHint value={row.amount} />
              </label>
            </div>
          </fieldset>
        )
      })}
      <p className="font-semibold text-brand">
        선택한 지출 합계:{' '}
        {Number.isSafeInteger(total) ? `${formatMeso(total)} 메소` : '금액을 확인해 주세요'}
      </p>
      {Number.isSafeInteger(total) && <MesoAmountHint value={total} />}
      <label className="flex items-start gap-2">
        <input
          aria-label="실제 비용과 수동 지출 중복 확인"
          className="mt-1"
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        실제 비용과 기존 수동 지출의 중복 여부를 확인했습니다.
      </label>
      {error && (
        <p role="alert" className="text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !valid || !confirmed}>
          {busy ? '반영 중…' : '선택한 강화 지출 반영'}
        </Button>
      </div>
    </form>
  )
}
