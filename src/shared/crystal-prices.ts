import { AppError } from './errors'
import type { CrystalPriceEntry } from './contracts/crystal-price.contract'

export const CRYSTAL_PRICES_CHECKED_ON = '2026-10-08'
export const CRYSTAL_PRICE_CHANGE_DATE = '2026-09-17'
// [boss, difficulty, September price, June price]. Solo base prices in mesos.
// June: https://maplestory.nexon.com/News/Update/806
// September: https://maplestory.nexon.com/News/Update/813 (live server, corrected notice).
// Hard Bellona: https://matsu1207.tistory.com/m/757 (cross-checked with Maple Week).
const prices: readonly (readonly [string, string, number, number])[] = [
  ['자쿰', '카오스', 4040000, 8080000],
  ['매그너스', '하드', 4280000, 8560000],
  ['피에르', '카오스', 4080000, 8170000],
  ['반반', '카오스', 4070000, 8150000],
  ['블러디퀸', '카오스', 4070000, 8140000],
  ['벨룸', '카오스', 4640000, 9280000],
  ['파풀라투스', '카오스', 6550000, 13100000],
  ['스우', '노멀', 8350000, 16700000],
  ['스우', '하드', 48900000, 51500000],
  ['스우', '익스트림', 545000000, 574000000],
  ['데미안', '노멀', 8750000, 17500000],
  ['데미안', '하드', 46400000, 48900000],
  ['가디언 엔젤 슬라임', '노멀', 12700000, 25500000],
  ['가디언 엔젤 슬라임', '카오스', 71300000, 75100000],
  ['루시드', '이지', 14900000, 29800000],
  ['루시드', '노멀', 17800000, 35600000],
  ['루시드', '하드', 59700000, 62900000],
  ['윌', '이지', 16100000, 32300000],
  ['윌', '노멀', 20500000, 41100000],
  ['윌', '하드', 73200000, 77100000],
  ['더스크', '노멀', 22000000, 44000000],
  ['더스크', '카오스', 66300000, 69800000],
  ['진 힐라', '노멀', 67600000, 71200000],
  ['진 힐라', '하드', 100000000, 106000000],
  ['듄켈', '노멀', 23700000, 47500000],
  ['듄켈', '하드', 89600000, 94400000],
  ['선택받은 세렌', '노멀', 167000000, 239000000],
  ['선택받은 세렌', '하드', 302000000, 356000000],
  ['선택받은 세렌', '익스트림', 1840000000, 2835000000],
  ['감시자 칼로스', '이지', 238000000, 280000000],
  ['감시자 칼로스', '노멀', 479000000, 505000000],
  ['감시자 칼로스', '카오스', 1230000000, 1273000000],
  ['감시자 칼로스', '익스트림', 4104000000, 4104000000],
  ['최초의 대적자', '이지', 261000000, 308000000],
  ['최초의 대적자', '노멀', 532000000, 560000000],
  ['최초의 대적자', '하드', 1390000000, 1435000000],
  ['최초의 대적자', '익스트림', 4712000000, 4712000000],
  ['카링', '이지', 320000000, 377000000],
  ['카링', '노멀', 593000000, 678000000],
  ['카링', '하드', 1560000000, 1739000000],
  ['카링', '익스트림', 5387000000, 5387000000],
  ['벨로나', '이지', 396000000, 440000000],
  ['벨로나', '노멀', 824000000, 850000000],
  ['벨로나', '하드', 2950000000, 2950000000],
  ['찬란한 흉성', '노멀', 576000000, 625000000],
  ['찬란한 흉성', '하드', 2678000000, 2678000000],
  ['림보', '노멀', 995000000, 1026000000],
  ['림보', '하드', 2385000000, 2385000000],
  ['발드릭스', '노멀', 1320000000, 1368000000],
  ['발드릭스', '하드', 3078000000, 3078000000],
  ['유피테르', '노멀', 1560000000, 1615000000],
  ['유피테르', '하드', 4845000000, 4845000000],
  ['검은 마법사', '하드', 465000000, 665000000],
  ['검은 마법사', '익스트림', 5680000000, 8740000000]
]

export const BUILTIN_CRYSTAL_HISTORY: readonly CrystalPriceEntry[] = prices.flatMap(
  ([bossName, difficulty, current, previous], index) => {
    const source =
      bossName === '벨로나' && difficulty === '하드'
        ? '보조 확인: https://matsu1207.tistory.com/m/757'
        : bossName === '벨로나' || bossName === '검은 마법사'
          ? '변경 전 가격 확인: https://maplestory.nexon.com/News/Update/813'
          : '6월 공지/기존 가격 대조: https://maplestory.nexon.com/News/Update/806 · https://maplewhoru.kr/boss/'
    return [
      {
        id: `builtin-${index}-first`,
        bossName,
        difficulty,
        amount: previous,
        effectiveOn: bossName === '벨로나' ? '2026-08-20' : '2026-06-18',
        checkedOn: CRYSTAL_PRICES_CHECKED_ON,
        source,
        isCustom: false
      },
      {
        id: `builtin-${index}-second`,
        bossName,
        difficulty,
        amount: current,
        effectiveOn: bossName === '검은 마법사' ? '2026-10-01' : CRYSTAL_PRICE_CHANGE_DATE,
        checkedOn: CRYSTAL_PRICES_CHECKED_ON,
        source:
          bossName === '벨로나' && difficulty === '하드'
            ? source
            : 'https://maplestory.nexon.com/News/Update/813',
        isCustom: false
      }
    ]
  }
)

export function findCrystalPrice(
  boss: string,
  difficulty: string,
  date: string,
  custom: readonly CrystalPriceEntry[] = []
): CrystalPriceEntry | undefined {
  let selected: CrystalPriceEntry | undefined
  for (const row of [...BUILTIN_CRYSTAL_HISTORY, ...custom]) {
    if (row.bossName !== boss || row.difficulty !== difficulty || row.effectiveOn > date) continue
    if (
      !selected ||
      row.effectiveOn > selected.effectiveOn ||
      (row.effectiveOn === selected.effectiveOn && row.isCustom)
    )
      selected = row
  }
  return selected
}

export function requireCrystalPrice(
  boss: string,
  difficulty: string,
  date: string,
  custom: readonly CrystalPriceEntry[] = []
): number {
  const price = findCrystalPrice(boss, difficulty, date, custom)
  if (!price)
    throw new AppError(
      'VALIDATION_ERROR',
      '해당 보스·난이도·날짜의 결정 가격표가 없습니다. 지원되는 기간을 선택해 주세요.'
    )
  return price.amount
}

export function crystalShare(price: number, partySize: number): number {
  return Number(BigInt(price) / BigInt(partySize))
}
