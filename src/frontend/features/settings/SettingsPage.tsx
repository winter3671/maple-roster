import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/contracts/app-api'
import { getBridge } from '../../lib/bridge'
import { NexonConnection } from '../nexon/NexonConnection'
import { BackupManager } from './BackupManager'
import { CrystalPriceManager } from './CrystalPriceManager'

export function SettingsPage() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => getBridge().system.getInfo())
      .then((result) => {
        if (active) setInfo(result)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">앱 정보</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">앱 이름</dt>
            <dd>{info?.name ?? 'Maple Roster'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">버전</dt>
            <dd>{info ? `v${info.version}` : error ? '확인 불가' : '확인 중'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">현재 상태</dt>
            <dd className={error ? 'text-expense' : 'text-brand'} role="status">
              {error
                ? '앱 정보를 불러오지 못했습니다'
                : info
                  ? '캐릭터·보스·사냥 장부·API 조회 사용 가능'
                  : '확인 중'}
            </dd>
          </div>
        </dl>
      </section>
      <NexonConnection />
      <CrystalPriceManager />
      <BackupManager />
    </div>
  )
}
