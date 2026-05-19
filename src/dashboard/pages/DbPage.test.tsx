import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
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

// ── TabSwitcher keyboard navigation tests ─────────────────────────────────────

describe('DbPage TabSwitcher — keyboard navigation', () => {
  function selectTable() {
    // Click a table in the sidebar to reveal the TabSwitcher
    const tableBtn = screen.getByRole('button', { name: /select table agent_runs/i })
    fireEvent.click(tableBtn)
  }

  it('renders two tabs with correct ARIA roles', () => {
    renderPage()
    selectTable()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveTextContent('Rows')
    expect(tabs[1]).toHaveTextContent('Schema')
  })

  it('active tab has aria-selected=true, inactive has aria-selected=false', () => {
    renderPage()
    selectTable()
    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    const schemaTab = screen.getByRole('tab', { name: /schema/i })
    // Rows is the default active tab after table selection
    expect(rowsTab).toHaveAttribute('aria-selected', 'true')
    expect(schemaTab).toHaveAttribute('aria-selected', 'false')
  })

  it('active tab has tabIndex=0, inactive has tabIndex=-1', () => {
    renderPage()
    selectTable()
    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    const schemaTab = screen.getByRole('tab', { name: /schema/i })
    expect(rowsTab).toHaveAttribute('tabindex', '0')
    expect(schemaTab).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight moves focus and activates the next tab', () => {
    renderPage()
    selectTable()
    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    const schemaTab = screen.getByRole('tab', { name: /schema/i })

    fireEvent.keyDown(rowsTab, { key: 'ArrowRight', code: 'ArrowRight' })

    expect(schemaTab).toHaveAttribute('aria-selected', 'true')
    expect(rowsTab).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowRight wraps from last tab to first tab', () => {
    renderPage()
    selectTable()
    // Click Schema to make it active first
    const schemaTab = screen.getByRole('tab', { name: /schema/i })
    fireEvent.click(schemaTab)
    expect(schemaTab).toHaveAttribute('aria-selected', 'true')

    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    fireEvent.keyDown(schemaTab, { key: 'ArrowRight', code: 'ArrowRight' })

    expect(rowsTab).toHaveAttribute('aria-selected', 'true')
    expect(schemaTab).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowLeft moves focus and activates the previous tab', () => {
    renderPage()
    selectTable()
    // Click Schema to make it active first
    const schemaTab = screen.getByRole('tab', { name: /schema/i })
    fireEvent.click(schemaTab)

    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    fireEvent.keyDown(schemaTab, { key: 'ArrowLeft', code: 'ArrowLeft' })

    expect(rowsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('Home key activates the first tab', () => {
    renderPage()
    selectTable()
    // Click Schema to make it active first
    const schemaTab = screen.getByRole('tab', { name: /schema/i })
    fireEvent.click(schemaTab)

    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    fireEvent.keyDown(schemaTab, { key: 'Home', code: 'Home' })

    expect(rowsTab).toHaveAttribute('aria-selected', 'true')
    expect(schemaTab).toHaveAttribute('aria-selected', 'false')
  })

  it('End key activates the last tab', () => {
    renderPage()
    selectTable()
    const rowsTab = screen.getByRole('tab', { name: /rows/i })
    const schemaTab = screen.getByRole('tab', { name: /schema/i })

    fireEvent.keyDown(rowsTab, { key: 'End', code: 'End' })

    expect(schemaTab).toHaveAttribute('aria-selected', 'true')
    expect(rowsTab).toHaveAttribute('aria-selected', 'false')
  })
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
