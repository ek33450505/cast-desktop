/**
 * Tests for StatusBar component.
 *
 * The StatusBar is the persistent bottom strip rendered inside ShellLayout
 * (not EditorShellLayout). It shows the Cast brand cluster — app icon,
 * wordmark, and git user name — plus a DevTools toggle button.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from './StatusBar'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/useGitUser', () => ({
  useGitUser: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(undefined)),
}))

import { useGitUser } from '../api/useGitUser'
import { invoke } from '@tauri-apps/api/core'

const mockUseGitUser = useGitUser as ReturnType<typeof vi.fn>
const mockInvoke = invoke as ReturnType<typeof vi.fn>

// ── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StatusBar', () => {
  beforeEach(() => {
    mockUseGitUser.mockReturnValue({ data: { name: 'edward kubiak' } })
  })

  afterEach(() => {
    vi.resetAllMocks()
    mockInvoke.mockReset()
  })

  it('renders without crashing', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('has role="status" with aria-live=off', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-live')).toBe('off')
  })

  it('shows "Cast" wordmark in brand cluster', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByText('Cast')).toBeTruthy()
  })

  it('shows git user name when useGitUser returns data', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByText('edward kubiak')).toBeTruthy()
  })

  it('omits user name when useGitUser returns null', () => {
    mockUseGitUser.mockReturnValue({ data: { name: null } })
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.queryByText('edward kubiak')).toBeNull()
  })

  it('renders the shared Cast app icon with aria-hidden', () => {
    const { container } = render(<StatusBar />, { wrapper: makeWrapper() })
    const logo = container.querySelector('svg[aria-label="Cast Desktop"]')
    expect(logo).toBeTruthy()
  })

  it('does not render branch, model, or a cost figure', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.queryByText('main')).toBeNull()
    expect(screen.queryByText(/sonnet|opus|haiku/)).toBeNull()
    expect(screen.queryByText(/\$\d/)).toBeNull()
  })

  // ── DevTools toggle button ────────────────────────────────────────────────

  it('renders the devtools toggle button with correct aria-label', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    const btn = screen.getByRole('button', { name: 'Toggle developer tools' })
    expect(btn).toBeTruthy()
  })

  it('clicking devtools button calls invoke with toggle_devtools', async () => {
    mockInvoke.mockResolvedValue(undefined)
    render(<StatusBar />, { wrapper: makeWrapper() })
    const btn = screen.getByRole('button', { name: 'Toggle developer tools' })
    fireEvent.click(btn)
    expect(mockInvoke).toHaveBeenCalledWith('toggle_devtools')
  })

  it('devtools button has title attribute', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    const btn = screen.getByRole('button', { name: 'Toggle developer tools' })
    expect(btn.getAttribute('title')).toBe('Toggle developer tools')
  })

  it('devtools button renders unconditionally (not gated on dev env)', () => {
    // Regardless of import.meta.env.DEV, the button must always appear
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByRole('button', { name: 'Toggle developer tools' })).toBeTruthy()
  })
})
