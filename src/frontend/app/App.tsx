import { useState } from 'react'
import { AppLayout } from './AppLayout'
import type { PageId } from './navigation'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { BossLedgerPage } from '../features/bosses/BossLedgerPage'
import { HuntingPage } from '../features/hunting/HuntingPage'
import { LedgerPage } from '../features/ledger/LedgerPage'
import { CharactersPage } from '../features/characters/CharactersPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { WeeklyPage } from '../features/weekly/WeeklyPage'

export function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const pages = {
    dashboard: <DashboardPage onNavigate={setPage} />,
    weekly: <WeeklyPage />,
    bosses: <BossLedgerPage />,
    hunting: <HuntingPage />,
    ledger: <LedgerPage />,
    characters: <CharactersPage />,
    settings: <SettingsPage />
  }

  return (
    <AppLayout page={page} onNavigate={setPage}>
      {pages[page]}
    </AppLayout>
  )
}
