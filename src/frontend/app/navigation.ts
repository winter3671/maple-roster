import type { IconName } from '../components/ui/Icon'

export type PageId = 'dashboard' | 'bosses' | 'hunting' | 'ledger' | 'characters' | 'settings'

export const navigation: { id: PageId; label: string; icon: IconName; description: string }[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: 'home',
    description: '캐릭터들의 수익 흐름을 한눈에 확인하세요.'
  },
  {
    id: 'bosses',
    label: '보스 장부',
    icon: 'boss',
    description: '보스 진행과 결정석·드랍 정산을 함께 관리하세요.'
  },
  {
    id: 'hunting',
    label: '사냥 장부',
    icon: 'hunting',
    description: '사냥한 시간과 획득한 메소를 회차별로 기록하세요.'
  },
  {
    id: 'ledger',
    label: '거래 내역',
    icon: 'ledger',
    description: '판매로 받은 메소와 사용한 메소를 정리하세요.'
  },
  {
    id: 'characters',
    label: '캐릭터 관리',
    icon: 'characters',
    description: '함께 기록할 캐릭터를 한곳에서 관리하세요.'
  },
  {
    id: 'settings',
    label: '설정',
    icon: 'settings',
    description: 'API 연결과 장부 보관 방식을 설정하세요.'
  }
]
