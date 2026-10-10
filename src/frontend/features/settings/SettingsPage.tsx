import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/contracts/app-api'
import { getBridge } from '../../lib/bridge'
import { NexonConnection } from '../nexon/NexonConnection'
import { BackupManager } from './BackupManager'
import { AutomaticBackupManager } from './AutomaticBackupManager'
import { CrystalPriceInfo } from './CrystalPriceInfo'
import { UpdateManager } from './UpdateManager'
import { ReleaseNotes } from './ReleaseNotes'
import { ThemeSettings } from './ThemeSettings'

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
            <dt className="text-muted">저장 방식</dt>
            <dd className="text-brand">이 기기에 자동 저장</dd>
          </div>
        </dl>
      </section>
      <ThemeSettings />
      <UpdateManager />
      <ReleaseNotes currentVersion={info?.version} />
      <NexonConnection />
      <CrystalPriceInfo />
      <AutomaticBackupManager />
      <BackupManager />
    </div>
  )
}
