import { useEffect, useId, useState, type FormEvent } from 'react'
import type { BossPresetInput } from '../../../shared/contracts/boss.contract'
import { parseBossPreset } from '../../../shared/contracts/boss.contract'
import type { Character } from '../../../shared/contracts/character.contract'
import { parseDigits, formatMeso } from '../../lib/format'
import { getKstDate } from '../../../shared/dates'
import { findCrystalPrice, crystalShare } from '../../../shared/crystal-prices'
import { Button } from '../../components/ui/Button'
import {
  WEEKLY_BOSSES,
  findWeeklyBoss,
  defaultBossDifficulty,
  bossPartyLimit,
  clampBossParty
} from '../../../shared/boss-catalog'

export const bossFieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:outline-brand disabled:opacity-50'
interface Props {
  characters: Character[]
  initial?: BossPresetInput
  busy: boolean
  onSave: (input: BossPresetInput) => Promise<boolean>
  onCancel?: () => void
}
export function BossPresetForm({ characters, initial, busy, onSave, onCancel }: Props) {
  const id = useId()
  const [draft, setDraft] = useState({
    characterId: initial?.characterId ?? '',
    bossName: initial?.bossName ?? '',
    difficulty: initial?.difficulty ?? '',
    partySize: String(initial?.partySize ?? 1)
  })
  const [error, setError] = useState('')
  const options = characters.filter((row) => !row.isHidden || row.id === initial?.characterId)
  useEffect(() => {
    if (!initial)
      setDraft((current) =>
        characters.some((row) => !row.isHidden && row.id === current.characterId)
          ? current
          : { ...current, characterId: characters.find((row) => !row.isHidden)?.id ?? '' }
      )
  }, [characters, initial])
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
      const input = parseBossPreset({
        ...draft,
        partySize: parseDigits(draft.partySize)
      })
      if ((await onSave(input)) && !initial)
        setDraft((current) => ({ ...current, bossName: '', difficulty: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '입력값을 확인해 주세요.')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div>
        <label htmlFor={`${id}-character`} className="text-xs font-semibold">
          프리셋 캐릭터
        </label>
        <select
          id={`${id}-character`}
          value={draft.characterId}
          onChange={(event) => change('characterId', event.target.value)}
          disabled={busy || Boolean(initial) || !options.length}
          required
          className={bossFieldClass}
        >
          <option value="" disabled>
            캐릭터 선택
          </option>
          {options.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.world}
              {row.isHidden ? ' (숨김)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-name`} className="text-xs font-semibold">
          주간 보스
        </label>
        <select
          id={`${id}-name`}
          value={draft.bossName}
          onChange={(event) => change('bossName', event.target.value)}
          required
          disabled={busy || Boolean(initial)}
          className={bossFieldClass}
        >
          <option value="" disabled>
            보스 선택
          </option>
          {initial && !findWeeklyBoss(initial.bossName) && (
            <option value={initial.bossName}>{initial.bossName} (기존 기록)</option>
          )}
          {WEEKLY_BOSSES.map((boss) => (
            <option key={boss.name} value={boss.name}>
              {boss.name}
            </option>
          ))}
        </select>
      </div>
      <BossDetailsFields
        id={id}
        draft={draft}
        bossName={draft.bossName}
        legacyDifficulty={initial?.difficulty}
        legacyPartySize={initial?.partySize}
        storedPrice={initial?.crystalPrice}
        busy={busy}
        change={change}
      />
      {!initial && (
        <p className="text-[11px] leading-5 text-muted">
          주간 보스 {WEEKLY_BOSSES.length}종을 지원합니다. 일간·월간 보스는 제외됩니다.
          보스·난이도·클리어 인원을 선택하면 결정석 수익이 자동 계산됩니다.
        </p>
      )}
      <p className="text-[11px] leading-5 text-muted">
        프리셋은 현재 가격표를 사용합니다. 주차 생성 시 해당 주차의 가격을 적용하고, 실제 수입은
        판매 확정 후 반영됩니다.
      </p>
      {error && (
        <p role="alert" className="text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            취소
          </Button>
        )}
        <Button type="submit" disabled={busy || !options.length}>
          {busy ? '저장 중…' : initial ? '프리셋 수정 저장' : '프리셋 추가'}
        </Button>
      </div>
    </form>
  )
}
export function BossDetailsFields({
  id,
  draft,
  bossName,
  legacyDifficulty,
  legacyPartySize,
  preserveStoredPrice = false,
  priceDate = getKstDate(),
  storedPrice,
  busy,
  change
}: {
  id: string
  draft: { difficulty: string; partySize: string }
  bossName: string
  legacyDifficulty?: string
  legacyPartySize?: number
  preserveStoredPrice?: boolean
  priceDate?: string
  storedPrice?: number
  busy: boolean
  change: (key: 'difficulty' | 'partySize', value: string) => void
}) {
  const difficulties = findWeeklyBoss(bossName)?.difficulties ?? []
  const legacy =
    legacyDifficulty && !difficulties.includes(legacyDifficulty) ? legacyDifficulty : undefined
  const price = findCrystalPrice(bossName, draft.difficulty, priceDate)
  const usingSnapshot = preserveStoredPrice && draft.difficulty === legacyDifficulty
  const amount = usingSnapshot ? storedPrice : (price?.amount ?? storedPrice)
  const maximum = bossPartyLimit(bossName, draft.difficulty)
  const legacyParty =
    draft.difficulty === legacyDifficulty &&
    legacyPartySize !== undefined &&
    legacyPartySize > maximum
      ? legacyPartySize
      : undefined
  const partySize = parseDigits(draft.partySize)
  const share =
    amount !== undefined && Number.isInteger(partySize) && partySize >= 1 && partySize <= 6
      ? crystalShare(amount, partySize)
      : undefined
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-difficulty`} className="text-xs font-semibold">
            난이도
          </label>
          <select
            id={`${id}-difficulty`}
            value={draft.difficulty}
            onChange={(event) => change('difficulty', event.target.value)}
            required
            disabled={busy || !bossName}
            className={bossFieldClass}
          >
            <option value="" disabled>
              {bossName ? '난이도 선택' : '보스를 먼저 선택하세요'}
            </option>
            {legacy && <option value={legacy}>{legacy} (기존 기록)</option>}
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
          {legacy && (
            <p className="mt-1 text-[11px] leading-5 text-muted">
              기존 입력값은 유지할 수 있습니다. 난이도를 변경할 때는 현재 목록에서 선택하세요.
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-party`} className="text-xs font-semibold">
            클리어 인원
          </label>
          <select
            id={`${id}-party`}
            value={draft.partySize}
            onChange={(event) => change('partySize', event.target.value)}
            required
            disabled={busy || !bossName || !draft.difficulty}
            className={bossFieldClass}
          >
            {Array.from({ length: maximum }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}명
              </option>
            ))}
            {legacyParty && <option value={legacyParty}>{legacyParty}명 (기존 기록)</option>}
          </select>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            {bossName && draft.difficulty
              ? `이 난이도는 최대 ${maximum}명까지 입장할 수 있습니다.`
              : '보스와 난이도를 먼저 선택하세요.'}
            {legacyParty ? ' 기존 인원은 유지할 수 있습니다.' : ''}
          </p>
        </div>
      </div>
      <div>
        <div className="rounded-xl bg-brand-soft p-4 text-xs leading-6">
          <p>
            1인 기준 결정석 가격{' '}
            <output aria-label="1인 기준 결정석 가격" className="font-semibold">
              {amount === undefined ? '보스·난이도를 선택하세요' : `${formatMeso(amount)} 메소`}
            </output>
          </p>
          <p>
            예상 내 몫{' '}
            <output aria-label="예상 결정석 내 몫" className="font-semibold text-brand">
              {share === undefined ? '클리어 인원을 확인하세요' : `${formatMeso(share)} 메소`}
            </output>
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {usingSnapshot
              ? '이 주차에 저장된 가격 · 1인 가격 ÷ 클리어 인원 · 1메소 미만 버림'
              : price
                ? `가격표 적용일 ${price.effectiveOn} · 1인 가격 ÷ 클리어 인원 · 1메소 미만 버림`
                : amount === undefined
                  ? '확인된 가격표가 없으면 자동 계산할 수 없습니다.'
                  : '가격표에 없는 기존 기록의 저장 가격을 유지합니다.'}
          </p>
        </div>
      </div>
    </>
  )
}
