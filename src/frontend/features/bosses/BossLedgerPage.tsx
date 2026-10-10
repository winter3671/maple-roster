import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { BossOverviewPage } from './BossOverviewPage'
import { BossesPage } from './BossesPage'

type BossView = 'overview' | 'weekly' | 'monthly'
const views: { id: BossView; label: string }[] = [
  { id: 'overview', label: '보스 진행도 및 정산' },
  { id: 'weekly', label: '주간 보스 기록' },
  { id: 'monthly', label: '월간 보스 기록' }
]

export function BossLedgerPage() {
  const [view, setView] = useState<BossView>('overview')
  const [syncBusy, setSyncBusy] = useState(false)
  return (
    <div className="space-y-5">
      <div
        role="group"
        aria-label="보스 장부 화면 선택"
        className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-3"
      >
        {views.map((item) => (
          <Button
            key={item.id}
            disabled={syncBusy}
            variant={view === item.id ? 'primary' : 'secondary'}
            aria-pressed={view === item.id}
            aria-controls="boss-ledger-content"
            onClick={() => setView(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <section id="boss-ledger-content" aria-label={views.find((item) => item.id === view)!.label}>
        {view === 'overview' ? (
          <BossOverviewPage onSyncBusyChange={setSyncBusy} />
        ) : (
          <BossesPage key={view} cycle={view} />
        )}
      </section>
    </div>
  )
}
