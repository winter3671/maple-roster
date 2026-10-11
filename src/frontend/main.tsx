import { lazy, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { CrystalPriceProvider } from './features/prices/CrystalPriceProvider'
import './styles/index.css'
import { PageContent } from './components/PageContent'
import { applyTheme, readTheme } from './lib/theme'

applyTheme(readTheme())

const UpdateRecovery = lazy(() =>
  import('./features/settings/UpdateRecovery').then((module) => ({
    default: module.UpdateRecovery
  }))
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.hash === '#update-recovery' ? (
      <PageContent>
        <UpdateRecovery />
      </PageContent>
    ) : (
      <CrystalPriceProvider>
        <App />
      </CrystalPriceProvider>
    )}
  </StrictMode>
)
