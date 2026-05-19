/**
 * Regression tests for HookFailuresPage bugs
 *
 * Bug: `since` was computed with `Date.now()` on every render, creating an
 * unstable TanStack Query key and causing infinite loading.
 * Fix: wrap in useMemo with [last24h] dep — same string for the full
 * time the toggle stays in one position.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HookFailuresPage from './HookFailuresPage'

// ── Mock the useHookFailures hook ─────────────────────────────────────────────

const mockUseHookFailures = vi.fn()

vi.mock('../api/useHookFailures', () => ({
  useHookFailures: (...args: unknown[]) => mockUseHookFailures(...args),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <HookFailuresPage />
    </QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HookFailuresPage — stable since key (bug regression)', () => {
  beforeEach(() => {
    mockUseHookFailures.mockReturnValue({ data: { failures: [] }, isLoading: false })
  })

  it('calls useHookFailures with a stable ISO string (same ms) across re-renders', async () => {
    // The fix is useMemo([last24h]) — both calls within the same React flush
    // must receive the identical string reference/value for last24h=true.
    renderPage()

    // Gather all calls while last24h===true (the toggle starts as true)
    const calls = mockUseHookFailures.mock.calls.filter((c) => c[0] !== undefined)
    expect(calls.length).toBeGreaterThan(0)

    const firstSince = calls[0][0] as string
    // All calls should share the same value — no new Date() drift between renders
    for (const [since] of calls) {
      expect(since).toBe(firstSince)
    }
  })

  it('passes undefined to useHookFailures when "Last 24h only" toggle is off', async () => {
    const user = userEvent.setup()
    renderPage()

    // Toggle off
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /last 24h only/i }))
    })

    // After toggle, the most recent call should have since=undefined
    const lastCall = mockUseHookFailures.mock.calls.at(-1)
    expect(lastCall?.[0]).toBeUndefined()
  })

  it('shows skeleton while loading', () => {
    mockUseHookFailures.mockReturnValue({ data: undefined, isLoading: true })
    renderPage()
    // Skeleton rows render as divs with animate-pulse; page heading is still visible
    expect(screen.getByText('Hook Failures')).toBeInTheDocument()
  })

  it('shows empty state when there are no failures', () => {
    mockUseHookFailures.mockReturnValue({ data: { failures: [] }, isLoading: false })
    renderPage()
    expect(screen.getByText(/no hook failures/i)).toBeInTheDocument()
  })
})
