import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../api/useRoutines', () => ({
  useRoutines: vi.fn(),
  useRoutineOutput: vi.fn(() => ({ data: null, isLoading: false, error: null })),
}))

import { useRoutines } from '../api/useRoutines'
import RoutinesPage from './RoutinesPage'

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RoutinesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const mockRoutine = {
  id: 'daily-briefing',
  name: 'daily-briefing',
  trigger_type: 'cron',
  trigger_value: '0 7 * * *',
  agent: 'morning-briefing',
  output_dir: '~/.claude/routines-output',
  enabled: 1,
  last_run_at: '2026-05-11T07:00:00.000Z',
  last_run_status: 'failure',
  last_run_output_path: '/Users/user/.claude/routines-output/daily-briefing.md',
  created_at: '2026-01-01T00:00:00.000Z',
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RoutinesPage', () => {
  it('renders skeleton cards when loading', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutines>)

    renderPage()

    // Skeleton container should be present
    expect(screen.getByRole('region', { name: /loading routines/i })).toBeInTheDocument()
  })

  it('renders empty state when no routines', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutines>)

    renderPage()

    expect(screen.getByText('No routines configured')).toBeInTheDocument()
  })

  it('renders a failed-run routine with failed StatusBadge', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [{ ...mockRoutine, last_run_status: 'failure' }] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutines>)

    renderPage()

    expect(screen.getByText('daily-briefing')).toBeInTheDocument()
    // StatusBadge sr-only text for 'failed' variant
    expect(screen.getByText('Status: failed')).toBeInTheDocument()
  })

  it('renders a successful-run routine with healthy StatusBadge', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [{ ...mockRoutine, last_run_status: 'success' }] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutines>)

    renderPage()

    expect(screen.getByText('daily-briefing')).toBeInTheDocument()
    expect(screen.getByText('Status: healthy')).toBeInTheDocument()
  })

  it('renders a never-run routine without failed or healthy badge', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [{ ...mockRoutine, last_run_status: null, last_run_at: null, last_run_output_path: null }] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutines>)

    renderPage()

    expect(screen.getByText('daily-briefing')).toBeInTheDocument()
    expect(screen.queryByText('Status: failed')).not.toBeInTheDocument()
    expect(screen.queryByText('Status: healthy')).not.toBeInTheDocument()
    // Shows "never" for last_run_at
    expect(screen.getByText(/never/i)).toBeInTheDocument()
  })

  it('renders error state with retry button', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutines>)

    renderPage()

    expect(screen.getByText('Could not load routines.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
