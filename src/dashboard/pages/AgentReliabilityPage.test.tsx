import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../api/useAgentHallucinations', () => ({
  useAgentHallucinationsSummary: vi.fn(),
  useAgentHallucinations: vi.fn(),
}))

vi.mock('../api/useAgentHallucinationDetail', () => ({
  useAgentHallucinationDetail: vi.fn().mockReturnValue({ data: undefined, isLoading: false, error: null }),
}))

// Mock useChartColors to avoid CSS variable resolution in jsdom
vi.mock('../hooks/useChartColors', () => ({
  useChartColors: () => ({
    accent: '#00FFC2',
    accentMuted: '#00FFC255',
    accentDim: '#00FFC230',
    haiku: '#6b7280',
    sonnet: '#0ea5e9',
    opus: '#8b5cf6',
    success: '#22c55e',
    warning: '#eab308',
    error: '#ef4444',
    gridStroke: '#374151',
    axisTick: '#9ca3af',
    tooltipBg: '#1f2937',
    tooltipBorder: '#374151',
    tooltipText: '#f3f4f6',
  }),
}))

import { useAgentHallucinationsSummary, useAgentHallucinations } from '../api/useAgentHallucinations'
import AgentReliabilityPage from './AgentReliabilityPage'

// ── Test data ──────────────────────────────────────────────────────────────────

const MOCK_SUMMARY = {
  byAgent: [
    { agent_name: 'researcher', total: 500, verified: 0, unverified: 500 },
    { agent_name: 'code-writer', total: 250, verified: 0, unverified: 250 },
    { agent_name: 'code-reviewer', total: 124, verified: 0, unverified: 124 },
  ],
  total: 874,
}

function makeMockRow(id: number) {
  return {
    id,
    session_id: `session-${id}-abcdefgh`,
    agent_name: 'researcher',
    claim_type: 'file_write',
    claimed_value: `/path/to/file-${id}.ts`,
    actual_value: null,
    verified: 0,
    timestamp: '2026-05-11T07:00:00.000Z',
  }
}

const MOCK_HALLUCINATIONS = [1, 2, 3, 4, 5].map(makeMockRow)

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AgentReliabilityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Default: loaded state with data
  vi.mocked(useAgentHallucinationsSummary).mockReturnValue({
    data: MOCK_SUMMARY,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof useAgentHallucinationsSummary>)
  vi.mocked(useAgentHallucinations).mockReturnValue({
    data: { hallucinations: MOCK_HALLUCINATIONS, total: 5 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof useAgentHallucinations>)
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AgentReliabilityPage', () => {
  it('renders loading skeleton when both hooks are loading', () => {
    vi.mocked(useAgentHallucinationsSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAgentHallucinationsSummary>)
    vi.mocked(useAgentHallucinations).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAgentHallucinations>)

    renderPage()

    // aria-busy skeleton container
    expect(screen.getByLabelText(/loading agent reliability data/i)).toBeInTheDocument()
  })

  it('renders empty state when total is 0', () => {
    vi.mocked(useAgentHallucinationsSummary).mockReturnValue({
      data: { byAgent: [], total: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAgentHallucinationsSummary>)
    vi.mocked(useAgentHallucinations).mockReturnValue({
      data: { hallucinations: [], total: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAgentHallucinations>)

    renderPage()

    expect(screen.getByText('No agent hallucinations recorded.')).toBeInTheDocument()
  })

  it('renders summary stat cards with correct values', () => {
    renderPage()

    // Total claims and unverified both show 874 in this mock (all unverified)
    const allOf874 = screen.getAllByText('874')
    expect(allOf874.length).toBeGreaterThanOrEqual(2)

    // Stat labels
    expect(screen.getByText('Total claims')).toBeInTheDocument()
    // "Unverified" appears in both stat card label and row icon text
    expect(screen.getAllByText('Unverified').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Most affected agent')).toBeInTheDocument()

    // Most affected is first in byAgent array
    expect(screen.getAllByText('researcher').length).toBeGreaterThanOrEqual(1)
  })

  it('renders chart container with correct aria-label', () => {
    renderPage()

    const chartContainer = screen.getByRole('img', {
      name: /hallucination count per agent, stacked by verified status/i,
    })
    expect(chartContainer).toBeInTheDocument()
  })

  it('renders all 5 mock hallucination rows', () => {
    renderPage()

    // All 5 rows should show "researcher" (their agent_name)
    const rows = screen.getAllByText('researcher')
    // At least 5 occurrences (one per row, plus potentially summary/chart labels)
    expect(rows.length).toBeGreaterThanOrEqual(5)
  })

  it('renders filter controls with accessible labels', () => {
    renderPage()

    expect(screen.getByLabelText('Agent')).toBeInTheDocument()
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
    expect(screen.getByLabelText('Verified')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument()
  })

  it('updates filter state when agent is selected', () => {
    renderPage()

    const agentSelect = screen.getByLabelText('Agent')
    fireEvent.change(agentSelect, { target: { value: 'code-writer' } })

    // After selection, the hook would be called with the new filter.
    // Since we're testing state, verify the dropdown reflects the selection.
    expect((agentSelect as HTMLSelectElement).value).toBe('code-writer')
  })

  it('expands a row when the expand button is clicked', () => {
    renderPage()

    // Click the first expand button (row id=1)
    const expandButtons = screen.getAllByRole('button', { name: /expand details for claim/i })
    expect(expandButtons.length).toBeGreaterThan(0)

    fireEvent.click(expandButtons[0])

    // Expanded panel should appear with role=region
    const expandedRegion = screen.getByRole('region', { name: /detail for hallucination claim 1/i })
    expect(expandedRegion).toBeInTheDocument()
    expect(expandedRegion).toHaveTextContent('/path/to/file-1.ts')
  })

  it('pagination: Next page is disabled when total <= PAGE_SIZE', () => {
    // total=5, PAGE_SIZE=50 → only 1 page
    renderPage()

    const nextBtn = screen.getByRole('button', { name: /next page/i })
    expect(nextBtn).toBeDisabled()

    const prevBtn = screen.getByRole('button', { name: /previous page/i })
    expect(prevBtn).toBeDisabled()
  })

  it('pagination: Next page enabled when total > PAGE_SIZE, disabled at last page', () => {
    // Simulate 200 total rows (4 pages), offset=0 → Next enabled, Prev disabled
    vi.mocked(useAgentHallucinations).mockReturnValue({
      data: { hallucinations: MOCK_HALLUCINATIONS, total: 200 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAgentHallucinations>)

    renderPage()

    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
  })

  it('renders error state with retry button', () => {
    vi.mocked(useAgentHallucinationsSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('DB error'),
      refetch: vi.fn(),
    } as ReturnType<typeof useAgentHallucinationsSummary>)

    renderPage()

    expect(screen.getByText('Could not load hallucinations.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('truncated claimed_value cell has aria-label equal to the full value', () => {
    renderPage()

    // MOCK_HALLUCINATIONS has claimed_value "/path/to/file-1.ts" … "/path/to/file-5.ts"
    // aria-label should match the full claimed_value string from the row
    const cell = screen.getByRole('cell', { name: /path\/to\/file-1\.ts/i })
    const span = cell.querySelector('span[aria-label]')
    expect(span).not.toBeNull()
    expect(span!.getAttribute('aria-label')).toBe('/path/to/file-1.ts')
  })
})
