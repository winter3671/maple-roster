import { parseDigits, formatMeso } from '../../lib/format'
import { getKstDate } from '../../../shared/dates'
import { crystalShare } from '../../../shared/crystal-prices'
import { useCrystalPrices } from '../prices/CrystalPriceProvider'
import { findBoss, bossPartyLimit } from '../../../shared/boss-catalog'

export const bossFieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:outline-brand disabled:opacity-50'
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
  const difficulties = findBoss(bossName)?.difficulties ?? []
  const { findPrice } = useCrystalPrices()
  const legacy =
    legacyDifficulty && !difficulties.includes(legacyDifficulty) ? legacyDifficulty : undefined
  const price = findPrice(bossName, draft.difficulty, priceDate)
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
            1인 기준 결정 가격{' '}
            <output aria-label="1인 기준 결정 가격" className="font-semibold">
              {amount === undefined ? '보스·난이도를 선택하세요' : `${formatMeso(amount)} 메소`}
            </output>
          </p>
          <p>
            예상 내 몫{' '}
            <output aria-label="예상 결정 내 몫" className="font-semibold text-brand">
              {share === undefined ? '클리어 인원을 확인하세요' : `${formatMeso(share)} 메소`}
            </output>
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {usingSnapshot
              ? '이 주차에 저장된 가격 · 1인 가격 ÷ 클리어 인원 · 1메소 미만 버림'
              : price
                ? `가격표 적용일 ${price.effectiveOn} · 확인일 ${price.checkedOn} · ${price.isCustom ? '수동 가격' : '앱 기본 가격'} · 1인 가격 ÷ 클리어 인원 · 1메소 미만 버림`
                : amount === undefined
                  ? '확인된 가격표가 없으면 자동 계산할 수 없습니다.'
                  : '가격표에 없는 기존 기록의 저장 가격을 유지합니다.'}
          </p>
        </div>
      </div>
    </>
  )
}
