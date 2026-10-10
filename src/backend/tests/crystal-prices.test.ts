import { describe, expect, it } from 'vitest'
import { WEEKLY_BOSSES } from '../../shared/boss-catalog'
import { findCrystalPrice, crystalShare } from '../../shared/crystal-prices'

describe('결정 가격표', () => {
  it('모든 주간 보스 난이도에 안전한 정수 가격이 있다', () => {
    for (const boss of WEEKLY_BOSSES) {
      for (const difficulty of boss.difficulties) {
        const amount = findCrystalPrice(boss.name, difficulty, '2026-10-08')?.amount
        expect(Number.isSafeInteger(amount)).toBe(true)
        expect(amount).toBeGreaterThan(0)
      }
    }
  })
  it('본 서버의 카링과 흉성 가격을 구분하고 나눗셈 나머지를 버린다', () => {
    expect(findCrystalPrice('카링', '노멀', '2026-09-17')?.amount).toBe(593000000)
    expect(findCrystalPrice('찬란한 흉성', '노멀', '2026-09-17')?.amount).toBe(576000000)
    expect(crystalShare(2950000000, 3)).toBe(983333333)
  })
  it('벨로나 출시 전과 지원하지 않는 조합에는 가격이 없다', () => {
    expect(findCrystalPrice('벨로나', '하드', '2026-08-19')).toBeUndefined()
    expect(findCrystalPrice('스우', '카오스', '2026-10-08')).toBeUndefined()
    expect(findCrystalPrice('스우', '노멀', '2026-06-17')).toBeUndefined()
  })
})
