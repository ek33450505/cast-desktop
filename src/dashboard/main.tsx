import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { Database } from 'lucide-react'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { applyAppearance, getInitialAppearance, useAppearance } from '../hooks/useAppearance'

// Apply appearance BEFORE createRoot to avoid flash-of-wrong-appearance on first paint
applyAppearance(getInitialAppearance())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function DevtoolsToggle() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        title="Query DevTools"
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          zIndex: 99999,
          width: '1.75rem',
          height: '1.75rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: 'var(--system-panel)',
          color: 'var(--accent)',
          border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          opacity: isOpen ? 1 : 0.65,
          transition: 'opacity 0.15s',
        }}
      >
        <Database size={11} />
      </button>
      {isOpen && (
        <ReactQueryDevtoolsPanel
          onClose={() => setIsOpen(false)}
          style={{ height: '500px' }}
        />
      )}
    </>
  )
}

export function Root() {
  const { appearance } = useAppearance()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <DevtoolsToggle />
        <Toaster
          theme={appearance === 'dawn' ? 'light' : 'dark'}
          position="bottom-right"
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Only mount when the #root element exists (skipped in test environments)
const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Root />
    </StrictMode>
  )
}
