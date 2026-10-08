import { describe, expect, it } from 'vitest'
import { compareBossProgression } from '../../shared/boss-order'

describe('주간 보스 진행 순서', () => {
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
