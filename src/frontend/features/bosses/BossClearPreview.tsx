import { useState, type FormEvent } from 'react'
import type { BossSyncPreview } from '../../../shared/contracts/boss-sync.contract'
import { getKstDate } from '../../../shared/dates'
import { Button } from '../../components/ui/Button'
import { formatMeso } from '../../lib/format'
import { bossPartyLimit } from '../../../shared/boss-catalog'
import { crystalShare } from '../../../shared/crystal-prices'

const labels = {
  ready: 'API 완료 · 반영 가능',
  alreadyCleared: '기존 클리어 유지',
  incomplete: 'API 미완료',
  missing: 'API 정보 없음',
  difficultyMismatch: '완료 난이도 불일치'
}
export function BossClearPreview({
  preview,
  busy,
  onApply,
  onReplace,
  onCancel
}: {
  preview: BossSyncPreview
  busy: boolean
  onApply: (ids: string[], date: string) => Promise<void>
  onReplace: (
    members: { bossName: string; difficulty: string; partySize: number }[],
    date: string
  ) => Promise<void>
  onCancel: () => void
}) {
  const [selected, setSelected] = useState(
    new Set(preview.rows.filter((row) => row.state === 'ready').map((row) => row.runId))
  )
  const [date, setDate] = useState(preview.incomeDate)
  const [replace, setReplace] = useState(false)
  const [members, setMembers] = useState(preview.replacement.members)
  const amount = replace
    ? members
        .filter((row) => !row.isCleared)
        .reduce((sum, row) => sum + crystalShare(row.crystalPrice, row.partySize), 0)
    : preview.rows
        .filter((row) => selected.has(row.runId))
        .reduce((sum, row) => sum + row.expectedShare, 0)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (replace)
      void onReplace(
        members.map(({ bossName, difficulty, partySize }) => ({ bossName, difficulty, partySize })),
        date
      )
    else void onApply([...selected], date)
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm font-semibold">
        {preview.characterName} · {preview.characterWorld}
      </p>
      <p className="text-xs leading-6 text-muted">
        조회 기준일 {preview.queriedDate} · 주차 {preview.week}
        <br />
        보스와 난이도가 일치한 API 완료 기록만 반영합니다. 기존 클리어와 수익은 유지하며,
        미완료·정보 없음은 체크를 해제하지 않습니다. 인원은 장부 설정을 사용합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={replace ? 'secondary' : 'primary'}
          disabled={busy}
          onClick={() => setReplace(false)}
        >
          기존 구성에 클리어만 반영
        </Button>
        <Button
          variant={replace ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => setReplace(true)}
        >
          API 완료 목록으로 주차 맞추기
        </Button>
      </div>
      {replace ? (
        <div className="space-y-3">
          <p className="text-xs leading-6 text-muted">
            API에서 완료한 {members.length}개 보스로 이 주차의 목록을 맞춥니다. 일치하는 기록은
            유지하고 새 보스를 추가합니다. 새 보스의 인원을 확인하세요.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="bg-canvas text-muted">
                <tr>
                  {['보스 · 난이도', '클리어 인원', '반영 후 결정석 내 몫'].map((label) => (
                    <th key={label} scope="col" className="px-3 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((row, index) => {
                  const maximum = bossPartyLimit(row.bossName, row.difficulty)
                  return (
                    <tr key={`${row.bossName}:${row.difficulty}`} className="border-t border-line">
                      <td className="px-3 py-3">
                        {row.bossName} · {row.difficulty}
                        {row.isCleared && (
                          <span className="block text-[11px] text-muted">
                            기존 클리어 수익·날짜 유지
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`${row.bossName} 교체 클리어 인원`}
                          disabled={busy || row.isCleared}
                          value={row.partySize}
                          onChange={(event) =>
                            setMembers((current) =>
                              current.map((member, i) =>
                                i === index
                                  ? { ...member, partySize: Number(event.target.value) }
                                  : member
                              )
                            )
                          }
                          className="rounded-lg border border-line bg-surface px-3 py-2"
                        >
                          {Array.from({ length: maximum }, (_, i) => i + 1).map((party) => (
                            <option key={party} value={party}>
                              {party}명
                            </option>
                          ))}
                          {row.partySize > maximum && (
                            <option value={row.partySize}>{row.partySize}명 (기존 기록)</option>
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {row.isCleared
                          ? '기존 수익 유지'
                          : `${formatMeso(crystalShare(row.crystalPrice, row.partySize))} 메소`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {Boolean(preview.replacement.removed.length) && (
            <div className="rounded-lg bg-canvas p-3 text-xs leading-6">
              <p className="font-semibold">이 주차에서 제외할 보스</p>
              {preview.replacement.removed.map((row) => (
                <p key={`${row.bossName}:${row.difficulty}`}>
                  {row.bossName} · {row.difficulty}
                </p>
              ))}
              <p className="text-muted">제외한 미클리어 기록과 메모는 이 주차에서 삭제합니다.</p>
            </div>
          )}
          {Boolean(preview.replacement.blockedReasons.length) && (
            <div
              role="alert"
              className="rounded-lg bg-expense/5 p-3 text-xs leading-6 text-expense"
            >
              {preview.replacement.blockedReasons.map((reason, index) => (
                <p key={index}>{reason}</p>
              ))}
              <p>
                기존 기록을 확인·정리한 뒤 다시 조회하세요. 기존 구성에 클리어만 반영하는 방식은
                계속 사용할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[500px] text-left text-xs">
              <thead className="bg-canvas text-muted">
                <tr>
                  {['선택', '보스 · 난이도 · 인원', '조회 결과', '결정석 내 몫'].map((label) => (
                    <th key={label} className="px-3 py-3" scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.runId} className="border-t border-line">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`${row.bossName} API 클리어 반영 선택`}
                        checked={selected.has(row.runId)}
                        disabled={busy || row.state !== 'ready'}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(row.runId)
                            else next.delete(row.runId)
                            return next
                          })
                        }
                        className="accent-brand"
                      />
                    </td>
                    <td className="px-3 py-3">
                      {row.bossName} · {row.difficulty} · {row.partySize}명
                    </td>
                    <td
                      className={`px-3 py-3 ${row.state === 'ready' ? 'text-brand' : 'text-muted'}`}
                    >
                      {labels[row.state]}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatMeso(row.expectedShare)} 메소</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Boolean(preview.unmatchedClears.length) && (
            <div className="rounded-lg bg-canvas p-3 text-xs leading-6">
              <p className="font-semibold">주차 구성과 일치하지 않는 API 완료 보스</p>
              <ul>
                {preview.unmatchedClears.map((row, index) => (
                  <li key={index}>
                    {row.bossName} · {row.difficulty}
                  </li>
                ))}
              </ul>
              <p className="text-muted">
                이 목록까지 반영하려면 ‘API 완료 목록으로 주차 맞추기’를 선택하세요.
              </p>
            </div>
          )}
        </>
      )}
      <label className="block text-xs font-semibold">
        수익 반영일
        <input
          aria-label="API 클리어 수익 반영일"
          type="date"
          value={date}
          min={preview.week}
          max={getKstDate()}
          disabled={busy}
          required
          onChange={(event) => setDate(event.target.value)}
          className="mt-2 block rounded-lg border border-line bg-surface px-3 py-2"
        />
      </label>
      <p className="text-xs leading-6 text-muted">
        API에는 정확한 처치 날짜가 없습니다. 현재 주차는 오늘, 과거 주차는 시작일을 기본값으로
        사용합니다. 실제 수익 날짜에 맞게 조정하세요. 조회 결과는 5분 동안 유효합니다.
      </p>
      <p className="text-sm font-semibold text-brand">
        {replace ? `완료 목록 ${members.length}개` : `선택 ${selected.size}개`} · 추가 반영 수익{' '}
        {formatMeso(amount)} 메소
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          닫기
        </Button>
        <Button
          type="submit"
          disabled={
            busy ||
            (replace
              ? !members.length || Boolean(preview.replacement.blockedReasons.length)
              : !selected.size)
          }
        >
          {replace ? 'API 완료 목록으로 교체 및 반영' : `선택한 ${selected.size}개 클리어 반영`}
        </Button>
      </div>
    </form>
  )
}
