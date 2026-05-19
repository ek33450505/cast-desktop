import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Root } from './main'
import { useAppearance } from '../hooks/useAppearance'
import { renderHook } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Minimal App stub — avoids pulling in full router/query deps from App
vi.mock('./App', () => ({
  default: () => <div data-testid="app-stub" />,
}))

// Capture Toaster props so we can assert on theme
let capturedToasterTheme: string | undefined
vi.mock('sonner', () => ({
  Toaster: (props: { theme?: string; position?: string }) => {
    capturedToasterTheme = props.theme
    return <div data-testid="toaster-stub" data-theme={props.theme} />
  },
}))

// ── localStorage / matchMedia stubs ──────────────────────────────────────────

const mockStorage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => mockStorage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { mockStorage[k] = v }),
  removeItem: vi.fn((k: string) => { delete mockStorage[k] }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]) }),
})

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

// Helper: set appearance via the shared store so Root re-reads it
function setAppearanceTo(a: 'dawn' | 'dusk') {
  const { result } = renderHook(() => useAppearance())
  act(() => {
    result.current.setAppearance(a)
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Root', () => {
  afterEach(() => {
    capturedToasterTheme = undefined
    // Reset to dusk (default) between tests
    setAppearanceTo('dusk')
  })

  it('passes theme="dark" to Toaster when appearance is dusk (default)', () => {
    setAppearanceTo('dusk')
    render(<Root />)
    const toaster = screen.getByTestId('toaster-stub')
    expect(toaster.dataset.theme).toBe('dark')
  })

  it('passes theme="light" to Toaster when appearance is dawn', () => {
    setAppearanceTo('dawn')
    render(<Root />)
    const toaster = screen.getByTestId('toaster-stub')
    expect(toaster.dataset.theme).toBe('light')
  })

  it('Toaster theme is never the hardcoded string "dark" when appearance is dawn', () => {
    setAppearanceTo('dawn')
    render(<Root />)
    expect(capturedToasterTheme).not.toBe('dark')
  })

  it('renders App inside the tree', () => {
    render(<Root />)
    expect(screen.getByTestId('app-stub')).toBeInTheDocument()
  })
})
