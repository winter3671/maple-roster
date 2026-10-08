import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { CrystalPriceProvider } from './features/prices/CrystalPriceProvider'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrystalPriceProvider>
      <App />
    </CrystalPriceProvider>
  </StrictMode>
)
