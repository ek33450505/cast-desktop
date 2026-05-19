/**
 * Tests for StatusBar component.
 *
 * The StatusBar is the persistent 32px-tall bottom strip rendered inside
 * ShellLayout (not EditorShellLayout). It shows branch / model / session cost.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from './StatusBar'
import type { SystemOverview } from '../../types'
import type { CostSummaryData } from '../api/useCostSummary'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/useSystem', () => ({
  useSystemHealth: vi.fn(),
}))

vi.mock('../api/useCostSummary', () => ({
  useCostSummary: vi.fn(),
}))

vi.mock('../api/useGitBranch', () => ({
  useGitBranch: vi.fn(),
}))

import { useSystemHealth } from '../api/useSystem'
import { useCostSummary } from '../api/useCostSummary'
import { useGitBranch } from '../api/useGitBranch'

const mockUseSystemHealth = useSystemHealth as ReturnType<typeof vi.fn>
const mockUseCostSummary = useCostSummary as ReturnType<typeof vi.fn>
const mockUseGitBranch = useGitBranch as ReturnType<typeof vi.fn>

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_HEALTH: Partial<SystemOverview> = {
  model: 'claude-sonnet-4-6',
  agentCount: 17,
  commandCount: 5,
  skillCount: 3,
  ruleCount: 8,
  planCount: 2,
  projectMemoryCount: 4,
  agentMemoryCount: 12,
  sessionCount: 42,
  groupCount: 1,
  directiveCount: 0,
  hooks: [],
  env: {},
}

const MOCK_COST: Partial<CostSummaryData> = {
  totals: {
    inputTokens: 50000,
    outputTokens: 20000,
    cacheCreationTokens: 5000,
    cacheReadTokens: 1000,
    costUsd: 3.47,
    sessionCount: 12,
  },
  byModel: [],
  topSessions: [],
  windowDays: 30,
}

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
    mockUseSystemHealth.mockReturnValue({ data: MOCK_HEALTH, isLoading: false })
    mockUseCostSummary.mockReturnValue({ data: MOCK_COST, isLoading: false })
    mockUseGitBranch.mockReturnValue({ data: { branch: 'main' } })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders without crashing', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('has role="status" attribute with aria-live=off (avoid spamming SR on 30s polls)', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    const el = screen.getByRole('status')
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-live')).toBe('off')
  })

  it('shows model name when health data is present', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByText('claude-sonnet-4-6')).toBeTruthy()
  })

  it('shows "—" for model during loading', () => {
    mockUseSystemHealth.mockReturnValue({ data: undefined, isLoading: true })
    render(<StatusBar />, { wrapper: makeWrapper() })
    // Model shows "—" when loading (at least 1 dash visible)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "—" for cost during loading', () => {
    mockUseCostSummary.mockReturnValue({ data: undefined, isLoading: true })
    render(<StatusBar />, { wrapper: makeWrapper() })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('formats cost as $X.XX when data is present', () => {
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByText('$3.47')).toBeTruthy()
  })

  it('shows live branch name when useGitBranch returns data', () => {
    mockUseGitBranch.mockReturnValue({ data: { branch: 'feature/phase-4-terminal-keybinds' } })
    render(<StatusBar />, { wrapper: makeWrapper() })
    expect(screen.getByText('feature/phase-4-terminal-keybinds')).toBeTruthy()
  })

  it('shows "—" for branch when useGitBranch returns null', () => {
    mockUseGitBranch.mockReturnValue({ data: { branch: null } })
    render(<StatusBar />, { wrapper: makeWrapper() })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "—" for branch when useGitBranch data is undefined (loading)', () => {
    mockUseGitBranch.mockReturnValue({ data: undefined })
    render(<StatusBar />, { wrapper: makeWrapper() })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})
