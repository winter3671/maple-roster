import { useEffect, useState } from 'react'
import type { DashboardStats } from '../../../shared/contracts/dashboard.contract'
import type { RecordQuery } from '../../../shared/contracts/ledger.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'

export function useDashboard(query: RecordQuery) {
  const [data, setData] = useState<DashboardStats>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setData(undefined)
    void unwrap(getBridge().dashboard.summary(query))
      .then((result) => {
        if (active) setData(result)
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof Error ? caught.message : '대시보드를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, revision])
  return { data, loading, error, reload: () => setRevision((value) => value + 1) }
}
