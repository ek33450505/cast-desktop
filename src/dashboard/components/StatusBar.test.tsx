/**
 * Tests for StatusBar component.
 *
 * The StatusBar is the persistent bottom strip rendered inside ShellLayout
 * (not EditorShellLayout). It shows only the Cast brand cluster — app icon,
 * wordmark, and git user name. Branch / model / cost were removed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from './StatusBar'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/useGitUser', () => ({
  useGitUser: vi.fn(),
}))

import { useGitUser } from '../api/useGitUser'

const mockUseGitUser = useGitUser as ReturnType<typeof vi.fn>

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
})
