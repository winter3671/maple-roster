import type { BossRun } from '../../../shared/contracts/boss.contract'
import type { Character } from '../../../shared/contracts/character.contract'
import { compareBossProgression } from '../../../shared/boss-order'
import { formatMeso } from '../../lib/format'
import { Button } from '../../components/ui/Button'

export function BossRunGroups({
  runs,
  characters,
  characterId,
  busy,
  canAdd,
  onAdd,
  onEdit,
  onDelete,
  onClear,
  onDrops
}: {
  runs: BossRun[]
  characters: Character[]
  characterId?: string
  busy: boolean
  canAdd: boolean
  onAdd: (character: Character) => void
  onEdit: (run: BossRun) => void
  onDelete: (run: BossRun) => void
  onClear: (run: BossRun, value: boolean) => void
  onDrops: (run: BossRun) => void
}) {
  const groups = new Map<string, { character: Character; world: string; runs: BossRun[] }>()
  for (const run of runs) {
    const key = JSON.stringify([run.characterWorld, run.characterId])
    if (!groups.has(key)) {
      const character = characters.find((row) => row.id === run.characterId)
      if (character) groups.set(key, { character, world: run.characterWorld, runs: [] })
    }
    groups.get(key)?.runs.push(run)
  }
  for (const character of characters.filter(
    (row) => !row.isHidden && (!characterId || row.id === characterId)
  )) {
    if (!runs.some((run) => run.characterId === character.id))
      groups.set(JSON.stringify([character.world, character.id]), {
        character,
        world: character.world,
        runs: []
      })
  }
  const servers = [...new Set([...groups.values()].map((group) => group.world))].sort((a, b) =>
    a.localeCompare(b, 'ko')
  )
  for (const group of groups.values()) group.runs.sort(compareBossProgression)
  return (
    <div className="space-y-6 p-5">
      {servers.map((world) => (
        <section key={world} aria-label={`${world} 보스 기록`} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted">{world}</h3>
          {[...groups.entries()]
            .filter(([, group]) => group.world === world)
            .map(([key, group]) => {
              const cleared = group.runs.filter((run) => run.isCleared).length
              const income = group.runs.reduce(
                (sum, run) =>
                  sum + (run.isCleared ? (run.settlement?.amount ?? run.expectedShare) : 0),
                0
              )
              const count = runs.filter((run) => run.characterId === group.character.id).length
              return (
                <article
                  key={key}
                  aria-label={`${group.character.name} 주간 보스`}
                  className="overflow-hidden rounded-xl border border-line"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-sm font-semibold">
                        {group.character.name}
                        {group.character.isHidden ? ' (숨김)' : ''}
                      </h4>
                      <span className="text-xs text-muted">
                        {cleared}/{group.runs.length} 완료
                      </span>
                      <span className="text-xs font-semibold text-brand">
                        {formatMeso(income)} 메소
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={busy || !canAdd || group.character.isHidden || count >= 12}
                      onClick={() => onAdd(group.character)}
                    >
                      + 보스 추가
                    </Button>
                  </div>
                  {group.runs.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[670px] text-left text-xs">
                        <thead className="text-muted">
                          <tr>
                            {[
                              '보스 · 난이도 · 인원',
                              '결정석 내 몫',
                              '클리어',
                              '반영 수익',
                              ''
                            ].map((title, index) => (
                              <th key={index} className="px-4 py-3 font-medium" scope="col">
                                {title}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.runs.map((run) => (
                            <tr key={run.id} className="border-t border-line">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  aria-label={`${run.characterName} ${run.bossName} 보스 정보 수정`}
                                  disabled={busy}
                                  onClick={() => onEdit(run)}
                                  className="rounded-lg px-2 py-2 text-left transition hover:bg-brand-soft focus-visible:outline-brand disabled:opacity-50"
                                >
                                  <span className="font-semibold">{run.bossName}</span>
                                  <span className="ml-2 text-muted">
                                    {run.difficulty} · {run.partySize}명
                                  </span>
                                </button>
                                {run.notes && (
                                  <p className="mt-1 max-w-64 whitespace-pre-wrap break-words px-2 text-muted">
                                    {run.notes}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {formatMeso(run.expectedShare)} 메소
                              </td>
                              <td className="px-4 py-3">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`${run.characterName} ${run.bossName} 클리어`}
                                    checked={run.isCleared}
                                    disabled={busy}
                                    onChange={(event) => onClear(run, event.target.checked)}
                                    className="accent-brand"
                                  />
                                  {run.isCleared ? '완료' : '미완료'}
                                </label>
                              </td>
                              <td
                                className="px-4 py-3 font-semibold tabular-nums text-brand"
                                title={
                                  run.settlement ? `수익 반영일 ${run.settlement.date}` : undefined
                                }
                              >
                                {formatMeso(
                                  run.isCleared ? (run.settlement?.amount ?? run.expectedShare) : 0
                                )}{' '}
                                메소
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="secondary"
                                    disabled={busy || !run.isCleared}
                                    onClick={() => onDrops(run)}
                                  >
                                    드랍 관리
                                  </Button>
                                  <button
                                    type="button"
                                    aria-label={`${run.characterName} ${run.bossName} 기록 삭제`}
                                    title="보스 기록 삭제"
                                    disabled={busy}
                                    onClick={() => onDelete(run)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-expense transition hover:bg-expense/10 focus-visible:outline-expense disabled:opacity-50"
                                  >
                                    ×
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="p-5 text-xs text-muted">
                      이번 주차의 보스가 없습니다. 보스를 추가하거나 프리셋으로 주차를 생성하세요.
                    </p>
                  )}
                </article>
              )
            })}
        </section>
      ))}
    </div>
  )
}
