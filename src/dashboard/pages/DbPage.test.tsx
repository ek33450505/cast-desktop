import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../api/useSqliteExplorer', () => ({
  useSqliteTables: vi.fn(),
  useSqliteTable: vi.fn(() => ({ data: null, isLoading: false, error: null })),
  useSqliteTableSchema: vi.fn(() => ({ data: null, isLoading: false, error: null })),
}))

import { useSqliteTables } from '../api/useSqliteExplorer'
import { DbPage } from './DbPage'

// All 7 tables used in badge tests
const MOCK_TABLES = [
  { name: 'agent_runs', rowCount: 42 },
  { name: 'parry_guard_events', rowCount: 0 },
  { name: 'injection_log', rowCount: 0 },
  { name: 'pane_bindings', rowCount: 0 },
  { name: 'budgets', rowCount: 0 },
  { name: 'stream_events', rowCount: 0 },
  { name: 'stream_hook_events', rowCount: 0 },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DbPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(useSqliteTables).mockReturnValue({
    data: { tables: MOCK_TABLES },
    isLoading: false,
    error: null,
  } as ReturnType<typeof useSqliteTables>)
})

// ── Badge presence tests ───────────────────────────────────────────────────────

describe('DbPage sidebar — stub badges', () => {
  it('agent_runs has NO status badge', () => {
    renderPage()
    // Find the sidebar button for agent_runs
    const btn = screen.getByRole('button', { name: /select table agent_runs/i })
    // No badge (role="img" with either "no writer" or "deferred" aria-label) inside this button
    expect(within(btn).queryByRole('img', { name: 'Table has no writer — data will always be empty' })).not.toBeInTheDocument()
    expect(within(btn).queryByRole('img', { name: 'Table is a deferred stub — no writer and no reader' })).not.toBeInTheDocument()
  })

  const NO_WRITER_TABLES = [
    'parry_guard_events',
    'injection_log',
    'pane_bindings',
    'budgets',
    'stream_events',
  ]

  it.each(NO_WRITER_TABLES)(
    '%s renders a "no writer" badge',
    (tableName) => {
      renderPage()
      const btn = screen.getByRole('button', { name: new RegExp(`select table ${tableName}`, 'i') })
      expect(
        within(btn).getByRole('img', { name: 'Table has no writer — data will always be empty' }),
      ).toBeInTheDocument()
    },
  )

  it('stream_hook_events renders a "deferred" badge', () => {
    renderPage()
    const btn = screen.getByRole('button', { name: /select table stream_hook_events/i })
    expect(
      within(btn).getByRole('img', { name: 'Table is a deferred stub — no writer and no reader' }),
    ).toBeInTheDocument()
  })

  it('total badge count is 6', () => {
    renderPage()
    // Exact aria-labels from StatusBadge VARIANT_CONFIG
    const noWriterBadges = screen.getAllByRole('img', { name: 'Table has no writer — data will always be empty' })
    const deferredBadges = screen.getAllByRole('img', { name: 'Table is a deferred stub — no writer and no reader' })
    expect(noWriterBadges).toHaveLength(5)
    expect(deferredBadges).toHaveLength(1)
    expect(noWriterBadges.length + deferredBadges.length).toBe(6)
  })
})
