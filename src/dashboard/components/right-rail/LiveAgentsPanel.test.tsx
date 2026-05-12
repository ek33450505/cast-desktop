import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LiveAgentsPanel from './LiveAgentsPanel'
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
      <LiveAgentsPanel />
    </QueryClientProvider>
  )
}

function makeAgent(overrides: Partial<{
  agentRunId: string; name: string; model: string;
  prompt: string; startedAt: string; tokenCount: number
}> = {}) {
  return {
    agentRunId: 'run-1',
    name: 'code-writer',
    model: 'claude-sonnet-4-6',
    prompt: 'Implement the thing',
    startedAt: new Date(Date.now() - 45_000).toISOString(),
    tokenCount: 2000,
    ...overrides,
  }
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
    json: async () => ({ agents: [] }),
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LiveAgentsPanel', () => {
  describe('Empty state', () => {
    it('renders "No active agents" when agents array is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [] }),
      })

      renderPanel()

      const emptyText = await screen.findByText('No active agents')
      expect(emptyText).toBeInTheDocument()
    })

    it('empty state has aria-label for screen readers', async () => {
      renderPanel()
      const container = await screen.findByLabelText('No active agents')
      expect(container).toBeInTheDocument()
    })
  })

  describe('Agent row rendering', () => {
    it('renders agent rows for running agents', async () => {
      const agent1 = makeAgent({ name: 'code-writer', agentRunId: 'run-1' })
      const agent2 = makeAgent({ name: 'code-reviewer', agentRunId: 'run-2', model: 'claude-haiku-4-5' })

      // Bind session
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [agent1, agent2] }),
      })

      renderPanel()

      expect(await screen.findByText('code-writer')).toBeInTheDocument()
      expect(screen.getByText('code-reviewer')).toBeInTheDocument()
    })

    it('renders correct model badge for haiku model', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent({ model: 'claude-haiku-4-5' })] }),
      })

      renderPanel()

      const badge = await screen.findByText('haiku')
      expect(badge).toBeInTheDocument()
    })

    it('renders correct model badge for opus model', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent({ model: 'claude-opus-4' })] }),
      })

      renderPanel()

      const badge = await screen.findByText('opus')
      expect(badge).toBeInTheDocument()
    })

    it('renders sonnet badge for non-haiku non-opus model', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent({ model: 'claude-sonnet-4-6' })] }),
      })

      renderPanel()

      const badge = await screen.findByText('sonnet')
      expect(badge).toBeInTheDocument()
    })

    it('renders elapsed timer for running agent', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      // Agent started 45 seconds ago
      const startedAt = new Date(Date.now() - 45_000).toISOString()

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent({ startedAt })] }),
      })

      renderPanel()

      // Should show elapsed time — at least "s" for seconds
      await screen.findByText('code-writer')
      // There should be a timer element
      const timerEls = document.querySelectorAll('[aria-live="off"]')
      expect(timerEls.length).toBeGreaterThan(0)
    })

    it('truncated prompt shows in title attribute for hover', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      const longPrompt = 'A'.repeat(60)

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent({ prompt: longPrompt })] }),
      })

      renderPanel()

      await screen.findByText('code-writer')
      const promptEl = document.querySelector(`[title="${longPrompt}"]`)
      expect(promptEl).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('agent table has role=table with aria-label', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent()] }),
      })

      renderPanel()

      await screen.findByText('code-writer')

      const table = screen.getByRole('table', { name: 'Running agents' })
      expect(table).toBeInTheDocument()
    })

    it('model badge has aria-label with tier', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [makeAgent({ model: 'claude-haiku-4-5' })] }),
      })

      renderPanel()

      await screen.findByText('code-writer')

      const badge = screen.getByLabelText('Model: haiku')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('SSE subscription', () => {
    it('creates EventSource on mount when sessionId is bound', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-xyz',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [] }),
      })

      renderPanel()

      await screen.findByText('No active agents')

      const sseInstance = MockEventSource.instances.find(es =>
        es.url.includes('sessionId=sess-xyz')
      )
      expect(sseInstance).toBeDefined()
    })

    it('does NOT create EventSource when sessionId is null', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: null,
        projectPath: null,
        endedAt: null,
        bound: false,
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [] }),
      })

      renderPanel()

      await screen.findByText('No active agents')

      // No SSE instance for agents/stream
      const sseInstance = MockEventSource.instances.find(es =>
        es.url.includes('/api/agents/stream')
      )
      expect(sseInstance).toBeUndefined()
    })

    it('closes EventSource on unmount', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'sess-abc',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [] }),
      })

      const { unmount } = renderPanel()

      await screen.findByText('No active agents')
      unmount()

      for (const es of MockEventSource.instances) {
        expect(es.close).toHaveBeenCalled()
      }
    })
  })
})
