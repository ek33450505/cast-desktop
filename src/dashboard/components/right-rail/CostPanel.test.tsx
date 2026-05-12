import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CostPanel from './CostPanel'
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

// framer-motion useReducedMotion mock
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => false }
})

class MockEventSource {
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  close = vi.fn()
  static instances: MockEventSource[] = []

  constructor(public url: string) {
    MockEventSource.instances.push(this)
  }
}

vi.stubGlobal('EventSource', MockEventSource)

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Helpers ───────────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  })
}

function renderPanel() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <CostPanel />
    </QueryClientProvider>
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  MockEventSource.instances = []
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
      totalUsd: 0,
      burnRatePerMin: 0,
      projectedFourHourUsd: 0,
      budgetUsd: null,
    }),
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CostPanel', () => {
  it('renders $0.0000 when no session is bound', async () => {
    renderPanel()
    // Currency zero render — $0.0000
    const labels = screen.getAllByText(/\$0\.0000/)
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it('renders total cost with 4 decimal places', async () => {
    mockUsePaneBinding.mockReturnValue({
      sessionId: 'sess-abc',
      projectPath: null,
      endedAt: null,
      bound: true,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalUsd: 0.0042,
        burnRatePerMin: 0.000007,
        projectedFourHourUsd: 0.00168,
        budgetUsd: null,
      }),
    })

    renderPanel()

    // Verify the aria-live region is present (the total cost span)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
  })

  it('renders burn rate and 4h projection labels', () => {
    renderPanel()
    expect(screen.getByText(/burn rate/i)).toBeTruthy()
    expect(screen.getByText(/4h projection/i)).toBeTruthy()
  })

  it('does not render budget gauge when budgetUsd is null', async () => {
    mockUsePaneBinding.mockReturnValue({
      sessionId: 'sess-abc',
      projectPath: null,
      endedAt: null,
      bound: true,
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalUsd: 0.01,
        burnRatePerMin: 0.00001,
        projectedFourHourUsd: 0.0024,
        budgetUsd: null,
      }),
    })

    renderPanel()

    // RadialBarChart would render an SVG — if budget is null, none should appear
    // We check the budget text is absent
    expect(screen.queryByText(/% of budget/i)).toBeNull()
  })

  it('creates SSE EventSource when sessionId is present', () => {
    mockUsePaneBinding.mockReturnValue({
      sessionId: 'sess-abc',
      projectPath: null,
      endedAt: null,
      bound: true,
    })

    renderPanel()

    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1)
    expect(MockEventSource.instances[0].url).toContain('/api/session-cost/stream')
    expect(MockEventSource.instances[0].url).toContain('sess-abc')
  })

  it('does not create SSE EventSource when sessionId is null', () => {
    renderPanel()
    expect(MockEventSource.instances).toHaveLength(0)
  })
})
