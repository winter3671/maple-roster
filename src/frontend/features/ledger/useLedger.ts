import { useEffect, useState } from 'react'
import type { LedgerPage, RecordQuery } from '../../../shared/contracts/ledger.contract'
import { AppError } from '../../../shared/errors'
import { ledgerApi } from './ledger.api'

export function useLedger(query: RecordQuery, page: number) {
  const [data, setData] = useState<LedgerPage>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setData(undefined)
    Promise.resolve()
      .then(() => ledgerApi.page({ ...query, page }))
      .then((list) => {
        if (active) setData(list)
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof AppError ? caught.message : '거래 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, page, revision])
  return { data, loading, error, reload: () => setRevision((value) => value + 1) }
}
