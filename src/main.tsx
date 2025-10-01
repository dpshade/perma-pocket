import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PasswordProvider } from './contexts/PasswordContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordProvider>
      <App />
    </PasswordProvider>
  </StrictMode>,
)
