import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ru } from '@/locales/ru'
import '@/index.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = `<div style="padding:24px;font-family:system-ui;background:#0a0a0b;color:#fafafa">${ru['main.rootMissing']}</div>`
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
