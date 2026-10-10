import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { CrystalPriceEntry } from '../../../shared/contracts/crystal-price.contract'
import { findCrystalPrice } from '../../../shared/crystal-prices'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'

const Context = createContext<{
  history: CrystalPriceEntry[]
  replace: (history: CrystalPriceEntry[]) => void
  reload: () => Promise<void>
} | null>(null)
export function CrystalPriceProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<CrystalPriceEntry[] | null>(null)
  const [error, setError] = useState('')
  async function reload() {
    try {
      setHistory(await unwrap(getBridge().prices.list()))
    } catch (caught) {
      setHistory(null)
      setError('장부 변경은 저장되었지만 가격표를 다시 불러오지 못했습니다. 다시 시도해 주세요.')
      throw caught
    }
  }
  useEffect(() => {
    let active = true
    void unwrap(getBridge().prices.list())
      .then((result) => {
        if (active) setHistory(result)
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof Error ? caught.message : '가격표를 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [])
  if (!history)
    return (
      <div className="p-8 text-sm">
        <p role={error ? 'alert' : 'status'}>{error || '가격표를 불러오는 중…'}</p>
        {error && (
          <Button
            onClick={() => {
              setError('')
              void reload().catch((caught) =>
                setError(caught instanceof Error ? caught.message : '가격표를 불러오지 못했습니다.')
              )
            }}
          >
            다시 시도
          </Button>
        )}
      </div>
    )
  return (
    <Context.Provider value={{ history, replace: setHistory, reload }}>{children}</Context.Provider>
  )
}
export function useCrystalPrices() {
  const value = useContext(Context)
  if (!value) throw new Error('가격표를 준비하지 못했습니다.')
  return {
    ...value,
    findPrice: (boss: string, difficulty: string, date: string) =>
      findCrystalPrice(boss, difficulty, date)
  }
}
