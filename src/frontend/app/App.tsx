import { lazy, useState } from 'react'
import { AppLayout } from './AppLayout'
import type { PageId } from './navigation'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { PageContent } from '../components/PageContent'

const BossLedgerPage = lazy(() =>
  import('../features/bosses/BossLedgerPage').then((module) => ({ default: module.BossLedgerPage }))
)
const HuntingPage = lazy(() =>
  import('../features/hunting/HuntingPage').then((module) => ({ default: module.HuntingPage }))
)
const LedgerPage = lazy(() =>
  import('../features/ledger/LedgerPage').then((module) => ({ default: module.LedgerPage }))
)
const CharactersPage = lazy(() =>
  import('../features/characters/CharactersPage').then((module) => ({
    default: module.CharactersPage
  }))
)
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage }))
)
const WeeklyPage = lazy(() =>
  import('../features/weekly/WeeklyPage').then((module) => ({ default: module.WeeklyPage }))
)

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
      <PageContent key={page}>{pages[page]}</PageContent>
    </AppLayout>
  )
}
