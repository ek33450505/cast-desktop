import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
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

export function Root() {
  const { appearance } = useAppearance()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
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
