import type { IconName } from '../components/ui/Icon'

export type PageId =
  'dashboard' | 'weekly' | 'bosses' | 'hunting' | 'ledger' | 'characters' | 'settings'

export const navigation: { id: PageId; label: string; icon: IconName; description: string }[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: 'home',
    description: '기간별 수입·지출·순수익과 캐릭터별 수익 흐름을 확인하세요.'
  },
  {
    id: 'weekly',
    label: '주간 콘텐츠',
    icon: 'weekly',
    description: '지하수로·플래그 참여 기록과 이번 주·지난주 점수를 확인하세요.'
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
    description: '30분 빠른 기록부터 드랍 판매까지, 사냥 수익을 회차별로 관리하세요.'
  },
  {
    id: 'ledger',
    label: '거래 내역',
    icon: 'ledger',
    description: '보스·사냥 수익과 메소·메이플포인트 지출을 확인하세요.'
  },
  {
    id: 'characters',
    label: '캐릭터 관리',
    icon: 'characters',
    description: '캐릭터와 서버, API 프로필 정보를 한곳에서 관리하세요.'
  },
  {
    id: 'settings',
    label: '설정',
    icon: 'settings',
    description: '테마, API 연결, 백업과 앱 업데이트를 관리하세요.'
  }
]
