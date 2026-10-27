import { lazy, useState } from 'react'
import { AppLayout } from './AppLayout'
import type { PageId } from './navigation'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { PageContent } from '../components/PageContent'
import { useInputProtection } from '../components/InputProtection'
import { StartupUpdatePrompt } from '../features/settings/StartupUpdatePrompt'
import { StartupDataSync } from './StartupDataSync'

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
  const { request } = useInputProtection()
  const navigate = (next: PageId) => {
    if (next !== page) request(() => setPage(next))
  }
  const pages = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    weekly: <WeeklyPage />,
    bosses: <BossLedgerPage />,
    hunting: <HuntingPage />,
    ledger: <LedgerPage />,
    characters: <CharactersPage />,
    settings: <SettingsPage />
  }

  return (
    <AppLayout page={page} onNavigate={navigate}>
      <PageContent key={page}>{pages[page]}</PageContent>
      <StartupUpdatePrompt />
      <StartupDataSync />
    </AppLayout>
  )
}
