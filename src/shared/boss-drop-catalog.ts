// Official major rewards are grouped by boss, not a complete difficulty-specific drop table.
// These are recording suggestions, not a guarantee of a drop or tradability.
// Checked 2026-10-09: https://maplestory.nexon.com/Guide/N23GameInformation/Articles/459
// Chaos chest contents: https://maplestory.nexon.com/News/Update/779
export const BOSS_DROP_CATALOG_CHECKED_ON = '2026-10-09'
export interface BossDropChoice {
  name: string
  openedFrom?: string
}
const majorRewards: Readonly<Record<string, readonly string[]>> = {
  자쿰: ['분노한 자쿰의 투구', '분노한 자쿰의 벨트', '응축된 힘의 결정석', '아쿠아틱 레터 눈장식'],
  매그너스: ['저주받은 카이세리움', '로얄 블랙메탈 숄더', '크리스탈 웬투스 뱃지'],
  피에르: ['조롱의 조각'],
  반반: ['시간의 조각'],
  블러디퀸: ['절규의 조각'],
  벨룸: ['파멸의 조각'],
  파풀라투스: ['파풀라투스 마크'],
  스우: ['루즈 컨트롤 머신 마크', '컴플리트 언더컨트롤', '스우로이드', '섬멸병기 스우로이드'],
  데미안: ['마력이 깃든 안대', '루인 포스실드', '데미안로이드'],
  '가디언 엔젤 슬라임': ['가디언 엔젤 링'],
  루시드: ['몽환의 벨트', '트와일라이트 마크', '루시드로이드'],
  윌: ['저주받은 마도서 선택 상자', '트와일라이트 마크', '거울세계의 코어 젬스톤'],
  더스크: ['거대한 공포', '에스텔라 이어링'],
  '진 힐라': ['고통의 근원', '데이브레이크 펜던트'],
  듄켈: ['커맨더 포스 이어링', '에스텔라 이어링'],
  '검은 마법사': [
    '창세의 뱃지',
    '익셉셔널 해머 (벨트)',
    '아케인셰이드 무기 상자',
    '아케인셰이드 방어구 상자'
  ],
  '선택받은 세렌': [
    '미트라의 분노 선택 상자',
    '데이브레이크 펜던트',
    '미트라의 코어 젬스톤',
    '익셉셔널 해머 (얼굴장식)'
  ],
  '감시자 칼로스': [
    '의지의 에테르넬 방어구 상자',
    '남겨진 칼로스의 의지',
    '남겨진 칼로스의 의지 조각',
    '생명의 연마석',
    '니키로이드',
    '익셉셔널 해머 (눈장식)'
  ],
  '최초의 대적자': [
    '불멸의 유산',
    '고대의 에테르넬 방어구 상자',
    '이어진 고대의 결의',
    '생명의 연마석',
    '대적자로이드',
    '익셉셔널 해머 (훈장)'
  ],
  카링: [
    '흉수의 에테르넬 방어구 상자',
    '뒤엉킨 흉수의 고리',
    '생명의 연마석',
    '카링로이드',
    '익셉셔널 해머 (귀고리)'
  ],
  벨로나: [
    '굶주리는 핏빛 원혼',
    '광기의 에테르넬 방어구 상자',
    '저주받은 원혼의 잔재',
    '신념의 연마석',
    '벨로나로이드'
  ],
  '찬란한 흉성': [
    '황홀한 악몽',
    '환상의 에테르넬 방어구 상자',
    '황홀한 환상의 단편',
    '황홀한 환상의 단편 조각',
    '생명의 연마석',
    '흉성 로이드'
  ],
  림보: [
    '근원의 속삭임',
    '욕망의 에테르넬 방어구 상자',
    '왜곡된 욕망의 결정',
    '신념의 연마석',
    '림보로이드'
  ],
  발드릭스: [
    '죽음의 맹세',
    '맹세의 에테르넬 방어구 상자',
    '영원한 충성의 흔적',
    '신념의 연마석',
    '발드릭스로이드'
  ],
  유피테르: [
    '오만의 원죄',
    '갈망의 에테르넬 방어구 상자',
    '뒤틀린 갈망의 편린',
    '신념의 연마석',
    '유피테르로이드'
  ]
}
const chaosChest = '혼돈의 칠흑 장신구 상자'
const chestBosses = new Set(['카링', '벨로나', '찬란한 흉성', '림보', '발드릭스', '유피테르'])
const chestResults = [
  '루즈 컨트롤 머신 마크',
  '마력이 깃든 안대',
  '몽환의 벨트',
  '저주받은 마도서 선택 상자',
  '거대한 공포',
  '커맨더 포스 이어링',
  '고통의 근원'
]

export function bossDropChoices(bossName: string): BossDropChoice[] {
  const direct = (majorRewards[bossName] ?? []).map((name) => ({ name }))
  if (!chestBosses.has(bossName)) return direct
  return [...direct, ...chestResults.map((name) => ({ name, openedFrom: chaosChest }))]
}
