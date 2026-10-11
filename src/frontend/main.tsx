import { lazy, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { CrystalPriceProvider } from './features/prices/CrystalPriceProvider'
import './styles/index.css'
import { PageContent } from './components/PageContent'
import { applyTheme, readTheme } from './lib/theme'
import { InputProtectionProvider } from './components/InputProtection'
import { TaskNotificationProvider } from './components/TaskNotifications'
import { ViewStateProvider } from './components/ViewState'
import { reportRendererIssue } from './lib/diagnostics'

applyTheme(readTheme())
window.addEventListener('error', () => reportRendererIssue('error'))
window.addEventListener('unhandledrejection', () => reportRendererIssue('unhandled-rejection'))

const UpdateRecovery = lazy(() =>
  import('./features/settings/UpdateRecovery').then((module) => ({
    default: module.UpdateRecovery
  }))
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TaskNotificationProvider>
      <InputProtectionProvider>
        {window.location.hash === '#update-recovery' ? (
          <PageContent>
            <UpdateRecovery />
          </PageContent>
        ) : (
          <ViewStateProvider>
            <CrystalPriceProvider>
              <App />
            </CrystalPriceProvider>
          </ViewStateProvider>
        )}
      </InputProtectionProvider>
    </TaskNotificationProvider>
  </StrictMode>
)
