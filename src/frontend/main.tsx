import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { CrystalPriceProvider } from './features/prices/CrystalPriceProvider'
import './styles/index.css'
import { UpdateRecovery } from './features/settings/UpdateRecovery'
import { applyTheme, readTheme } from './lib/theme'

applyTheme(readTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.hash === '#update-recovery' ? (
      <UpdateRecovery />
    ) : (
      <CrystalPriceProvider>
        <App />
      </CrystalPriceProvider>
    )}
  </StrictMode>
)
