import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { installGlobalErrorHandlers } from './shared/errorReporting'
import './index.css'

installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </StrictMode>,
)
