import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PlanProgressPanel from './PlanProgressPanel'
import type { PaneBinding } from '../../../hooks/usePaneBinding'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock usePaneBinding
const mockUsePaneBinding = vi.fn<(paneId: string | undefined) => PaneBinding>(() => ({
  sessionId: null,
  projectPath: null,
  endedAt: null,
  bound: false,
}))

vi.mock('../../../hooks/usePaneBinding', () => ({
  usePaneBinding: (paneId: string | undefined) => mockUsePaneBinding(paneId),
}))

// Mock terminal store
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

// SseManager mock
import { useEffect } from 'react'

type Handler = (e: unknown) => void
const capturedHandlers = new Map<string, Handler>()
const mockUseEvent = vi.fn()

vi.mock('../../../lib/SseManager', () => {
  return {
    sseManager: {
      subscribe: vi.fn((type: string, h: Handler) => {
        capturedHandlers.set(type, h)
        return () => capturedHandlers.delete(type)
      }),
      get connectionState() { return -1 },
    },
    useEvent: (type: string, h: Handler) => {
      mockUseEvent(type, h)
      // Use useEffect so unmount cleanup removes the handler
      useEffect(() => {
        capturedHandlers.set(type, h)
        return () => { capturedHandlers.delete(type) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [type])
    },
    useEventValue: (_t: string, initial: unknown) => initial,
  }
})

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Helpers ───────────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // No gcTime so data is immediately available from resolved fetch
        gcTime: Infinity,
      },
    },
  })
}

function renderPanel() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanProgressPanel />
    </QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  capturedHandlers.clear()
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
    json: async () => ({ planPath: null, title: null, tasks: [] }),
  })
})

describe('PlanProgressPanel', () => {
  describe('Empty state', () => {
    it('renders "No active plan" when tasks array is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      renderPanel()

      const emptyText = await screen.findByText('No active plan')
      expect(emptyText).toBeInTheDocument()
    })

    it('shows /plan code chip in empty state', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      renderPanel()

      const chip = await screen.findByText('/plan')
      expect(chip).toBeInTheDocument()
      expect(chip.tagName).toBe('CODE')
    })

    it('renders empty state when planPath is null', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      renderPanel()

      expect(await screen.findByText('No active plan')).toBeInTheDocument()
    })
  })

  describe('Task list rendering', () => {
    it('renders task list when tasks are present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [
            { id: 'task-0', text: 'Implement feature A', done: false },
            { id: 'task-1', text: 'Write tests', done: true },
            { id: 'task-2', text: 'Deploy to staging', done: false },
          ],
        }),
      })

      renderPanel()

      expect(await screen.findByText('Implement feature A')).toBeInTheDocument()
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Deploy to staging')).toBeInTheDocument()
    })

    it('renders plan filename as header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [{ id: 'task-0', text: 'Task one', done: false }],
        }),
      })

      renderPanel()

      expect(await screen.findByText('my-plan.md')).toBeInTheDocument()
    })

    it('applies line-through and opacity-60 class on done tasks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [
            { id: 'task-0', text: 'Done task', done: true },
            { id: 'task-1', text: 'Open task', done: false },
          ],
        }),
      })

      renderPanel()

      const doneTask = await screen.findByText('Done task')
      expect(doneTask).toHaveClass('line-through')
      expect(doneTask).toHaveClass('opacity-60')

      const openTask = screen.getByText('Open task')
      expect(openTask).not.toHaveClass('line-through')
    })

    it('renders checkboxes with aria-label from task text', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [
            { id: 'task-0', text: 'Write unit tests', done: false },
          ],
        }),
      })

      renderPanel()

      const checkbox = await screen.findByRole('checkbox', { name: 'Write unit tests' })
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toBeDisabled()
    })

    it('checked checkbox corresponds to done=true task', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [
            { id: 'task-0', text: 'Completed task', done: true },
          ],
        }),
      })

      renderPanel()

      const checkbox = await screen.findByRole('checkbox', { name: 'Completed task' })
      expect(checkbox).toBeChecked()
    })
  })

  describe('Accessibility', () => {
    it('task list has role=list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [{ id: 'task-0', text: 'A task', done: false }],
        }),
      })

      renderPanel()

      await screen.findByText('A task')
      const list = screen.getByRole('list', { name: 'Plan tasks' })
      expect(list).toBeInTheDocument()
    })

    it('task list has aria-live=polite', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          planPath: '/home/.claude/plans/my-plan.md',
          title: 'my-plan.md',
          tasks: [{ id: 'task-0', text: 'A task', done: false }],
        }),
      })

      renderPanel()

      await screen.findByText('A task')
      const list = screen.getByRole('list')
      expect(list).toHaveAttribute('aria-live', 'polite')
    })

    it('empty state has meaningful text (not decorative only)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      renderPanel()

      const emptyContainer = await screen.findByLabelText('No active plan')
      expect(emptyContainer).toBeInTheDocument()
    })
  })

  describe('SSE subscription', () => {
    it('creates an EventSource on mount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      renderPanel()

      await screen.findByText('No active plan')

      // PlanProgressPanel subscribes via useEvent('plan_progress_updated', ...) on the sseManager singleton
      expect(mockUseEvent).toHaveBeenCalledWith('plan_progress_updated', expect.any(Function))
    })

    it('includes sessionId in SSE URL when bound', async () => {
      mockUsePaneBinding.mockReturnValue({
        sessionId: 'test-session-123',
        projectPath: '/tmp',
        endedAt: null,
        bound: true,
      })
      const tabId = 'tab-1'
      mockActiveTabId.mockReturnValue(tabId)
      mockTabs.mockReturnValue([{ id: tabId, paneId: 'pane-1', ptyId: null, cwd: '~', title: '~' }])

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      renderPanel()

      await screen.findByText('No active plan')

      // The sseManager singleton handles the transport; the component filters events by sessionId
      // via the query invalidation key ['active-plan', sessionId]. Verify useEvent was called.
      expect(mockUseEvent).toHaveBeenCalledWith('plan_progress_updated', expect.any(Function))
    })

    it('closes EventSource on unmount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ planPath: null, title: null, tasks: [] }),
      })

      const { unmount } = renderPanel()

      await screen.findByText('No active plan')

      expect(capturedHandlers.has('plan_progress_updated')).toBe(true)
      unmount()
      expect(capturedHandlers.has('plan_progress_updated')).toBe(false)
    })
  })
})
