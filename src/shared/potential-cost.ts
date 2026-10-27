import type { PotentialRecord } from './contracts/enhancement.contract'

// Official live-server notices (not the test world):
// https://maplestory.nexon.com/News/Update/737 (2024-01-25)
// https://maplestory.nexon.com/News/Update/746 (2024-06-20)
export const POTENTIAL_COST_SOURCES = [
  'https://maplestory.nexon.com/News/Update/737',
  'https://maplestory.nexon.com/News/Update/746'
] as const
const grades = ['레어', '에픽', '유니크', '레전드리']
const normal = [
  [4000000, 16000000, 34000000, 40000000],
  [4250000, 17000000, 36125000, 42500000],
  [4500000, 18000000, 38250000, 45000000],
  [5000000, 20000000, 42500000, 50000000]
]
const additional = [
  [9750000, 27300000, 66300000, 78000000],
  [10375000, 29050000, 70550000, 83000000],
  [11000000, 30800000, 74800000, 88000000],
  [12250000, 34300000, 83300000, 98000000]
]
export function potentialCost(record: PotentialRecord): number | null {
  const index = grades.indexOf(
    record.beforeGrade === '레전더리' ? '레전드리' : (record.beforeGrade ?? '')
  )
  const level = record.itemLevel
  if (index < 0 || level === null || !Number.isInteger(level) || level < 1 || level > 300)
    return null
  const band = level < 160 ? 0 : level < 200 ? 1 : level < 250 ? 2 : 3
  if (record.kind === '잠재능력' && record.date >= '2024-01-25') return normal[band][index]
  if (record.kind === '에디셔널 잠재능력' && record.date >= '2024-06-20')
    return additional[band][index]
  return null
}
