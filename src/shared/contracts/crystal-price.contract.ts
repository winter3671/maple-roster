export interface CrystalPriceEntry {
  id: string
  bossName: string
  difficulty: string
  amount: number
  effectiveOn: string
  checkedOn: string
  source: string
  isCustom: boolean
}
export type CrystalPriceInput = Pick<
  CrystalPriceEntry,
  'bossName' | 'difficulty' | 'amount' | 'effectiveOn' | 'checkedOn' | 'source'
>
