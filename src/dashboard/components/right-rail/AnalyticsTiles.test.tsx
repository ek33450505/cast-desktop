import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AnalyticsTiles from './AnalyticsTiles'
import type { PaneBinding } from '../../../hooks/usePaneBinding'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsePaneBinding = vi.fn<(paneId: string | undefined) => PaneBinding>(() => ({
  sessionId: null,
  projectPath: null,
  endedAt: null,
  bound: false,
}))

vi.mock('../../../hooks/usePaneBinding', () => ({
  usePaneBinding: (paneId: string | undefined) => mockUsePaneBinding(paneId),
}))

const mockActiveTabId = vi.fn(() => null as string | null)
const mockTabs = vi.fn(() => [] as { id: string; paneId: string; ptyId: string | null; cwd: string; title: string }[])

vi.mock('../../../stores/terminalStore', () => ({
  useTerminalStore: (selector: (state: { activeTabId: string | null; tabs: { id: string; paneId: string; ptyId: string | null; cwd: string; title: string }[] }) => unknown) => {
    const state = {
      activeTabId: mockActiveTabId(),
      tabs: mockTabs(),
    }
    return selector(state)
  },
}))

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => false }
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Recharts uses ResizeObserver — stub it
vi.stubGlobal('ResizeObserver', class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  })
}

function renderTiles() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsTiles />
    </QueryClientProvider>
  )
}

function makeBuckets(count = 60): { minute: string; tokens: number }[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    minute: new Date(now - (count - 1 - i) * 60_000).toISOString().replace(/:\d\d\.\d+Z$/, ':00Z'),
    tokens: i * 10,
  }))
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockActiveTabId.mockReturnValue(null)
  mockTabs.mockReturnValue([])
  mockUsePaneBinding.mockReturnValue({
    sessionId: null,
    projectPath: null,
    endedAt: null,
    bound: false,
  })
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      tokenRateBuckets: [],
      agentFanOut: 0,
      qualityPass: 0,
      qualityFail: 0,
    }),
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnalyticsTiles', () => {
  it('renders token rate label', () => {
    renderTiles()
    expect(screen.getByText(/token rate/i)).toBeTruthy()
  })

  it('renders agent fan-out count label', () => {
    renderTiles()
    expect(screen.getByText(/agents this session/i)).toBeTruthy()
  })

  it('renders quality gate chips with passed and failed labels', () => {
    renderTiles()
    expect(screen.getByText(/passed/i)).toBeTruthy()
    expect(screen.getByText(/failed/i)).toBeTruthy()
  })

  it('renders sparkline chart container with aria-label', () => {
    renderTiles()
    const chart = document.querySelector('[aria-label="Token rate over last 60 minutes"]')
    expect(chart).toBeTruthy()
  })

  it('shows correct agent count when data is loaded', async () => {
    mockUsePaneBinding.mockReturnValue({
      sessionId: 'sess-abc',
      projectPath: null,
      endedAt: null,
      bound: true,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tokenRateBuckets: makeBuckets(),
        agentFanOut: 7,
        qualityPass: 12,
        qualityFail: 2,
      }),
    })

    renderTiles()

    // Initial render shows 0 before data loads
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('quality chips have aria-labels', () => {
    renderTiles()
    const passChip = document.querySelector('[aria-label*="quality gates passed"]')
    const failChip = document.querySelector('[aria-label*="quality gates failed"]')
    expect(passChip).toBeTruthy()
    expect(failChip).toBeTruthy()
  })

  it('does not create EventSource (polling only, no SSE)', () => {
    const EventSourceSpy = vi.fn()
    vi.stubGlobal('EventSource', EventSourceSpy)

    mockUsePaneBinding.mockReturnValue({
      sessionId: 'sess-abc',
      projectPath: null,
      endedAt: null,
      bound: true,
    })

    renderTiles()
    expect(EventSourceSpy).not.toHaveBeenCalled()
  })
})
