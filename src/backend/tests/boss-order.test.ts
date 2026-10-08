import { describe, expect, it, vi } from 'vitest'
import { compareBossProgression } from '../../shared/boss-order'
import { BOSS_DISPLAY_ORDER } from '../../shared/boss-display-order'
import { WEEKLY_BOSSES } from '../../shared/boss-catalog'
import * as prices from '../../shared/crystal-prices'

describe('주간 보스 진행 순서', () => {
  it('현재 카탈로그의 모든 보스·난이도가 중복과 누락 없이 정렬 데이터에 포함된다', () => {
    const known = WEEKLY_BOSSES.flatMap((boss) =>
      boss.difficulties.map((difficulty) => JSON.stringify([boss.name, difficulty]))
    )
    const ordered = BOSS_DISPLAY_ORDER.map((row) => JSON.stringify(row))
    expect(new Set(ordered).size).toBe(ordered.length)
    expect([...ordered].sort()).toEqual([...known].sort())
  })
  it('가격 조회 함수와 기본 가격 이력이 변경되어도 표시 순서는 그대로다', () => {
    const spy = vi.spyOn(prices, 'findCrystalPrice').mockImplementation(() => {
      throw new Error('정렬에서 가격을 조회하면 안 됩니다.')
    })
    try {
      const rows = [
        { bossName: '찬란한 흉성', difficulty: '노멀' },
        { bossName: '스우', difficulty: '익스트림' },
        { bossName: '데미안', difficulty: '노멀' }
      ]
      expect(rows.sort(compareBossProgression).map((row) => row.bossName)).toEqual([
        '데미안',
        '스우',
        '찬란한 흉성'
      ])
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
  it('정렬표에 없는 기존 난이도·이름은 알려진 조합 뒤에 일관되게 표시한다', () => {
    const rows = [
      { bossName: '기존 보스', difficulty: '하드' },
      { bossName: '스우', difficulty: '기존 난이도' },
      { bossName: '카링', difficulty: '익스트림' },
      { bossName: '기존 보스', difficulty: '노멀' }
    ]
    expect(rows.sort(compareBossProgression)).toEqual([
      { bossName: '카링', difficulty: '익스트림' },
      { bossName: '스우', difficulty: '기존 난이도' },
      { bossName: '기존 보스', difficulty: '노멀' },
      { bossName: '기존 보스', difficulty: '하드' }
    ])
  })
  it('익세노흉 구성은 익스트림 스우와 노멀 흉성이 마지막에 온다', () => {
    const selections = [
      ['스우', '익스트림'],
      ['찬란한 흉성', '노멀'],
      ['최초의 대적자', '노멀'],
      ['감시자 칼로스', '노멀'],
      ['벨로나', '이지'],
      ['카링', '이지'],
      ['선택받은 세렌', '하드'],
      ['진 힐라', '하드'],
      ['듄켈', '하드'],
      ['윌', '하드'],
      ['가디언 엔젤 슬라임', '카오스'],
      ['더스크', '카오스']
    ].map(([bossName, difficulty], index) => ({
      bossName,
      difficulty,
      partySize: (index % 3) + 1,
      crystalPrice: 12 - index
    }))
    expect(
      selections
        .sort(compareBossProgression)
        .map(({ bossName, difficulty }) => `${difficulty} ${bossName}`)
    ).toEqual([
      '카오스 더스크',
      '카오스 가디언 엔젤 슬라임',
      '하드 윌',
      '하드 듄켈',
      '하드 진 힐라',
      '하드 선택받은 세렌',
      '이지 카링',
      '이지 벨로나',
      '노멀 감시자 칼로스',
      '노멀 최초의 대적자',
      '익스트림 스우',
      '노멀 찬란한 흉성'
    ])
  })
  it('스우도 난이도에 따라 위치가 달라지고 기존 자유 입력 기록은 뒤에 유지된다', () => {
    const selections = [
      { bossName: '기존 보스', difficulty: '기존 난이도' },
      { bossName: '스우', difficulty: '익스트림' },
      { bossName: '데미안', difficulty: '노멀' },
      { bossName: '스우', difficulty: '노멀' }
    ]
    expect(selections.sort(compareBossProgression).map((row) => row.bossName)).toEqual([
      '스우',
      '데미안',
      '스우',
      '기존 보스'
    ])
  })
})
