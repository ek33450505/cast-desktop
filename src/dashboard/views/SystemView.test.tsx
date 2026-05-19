import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => true),
    motion: {
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// Mock PreviewModal to a simple stub that shows the path and an Escape handler
vi.mock('../components/left-rail/PreviewModal', () => ({
  default: ({
    path,
    onClose,
  }: {
    path: string
    source?: string
    onClose: () => void
    triggerRef?: React.RefObject<HTMLElement | null>
  }) => (
    <div
      data-testid="preview-modal"
      data-path={path}
      role="dialog"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <button onClick={onClose} aria-label="Close preview">Close</button>
    </div>
  ),
}))

// Mock all API hooks used by SystemView
vi.mock('../api/useAgents', () => ({
  useAgents: vi.fn(() => ({
    data: [
      { name: 'code-writer', model: 'sonnet', description: 'Writes code', filePath: '/home/.claude/agents/code-writer.md', color: '', tools: [], maxTurns: 0, memory: 'local' },
      { name: 'code-reviewer', model: 'haiku', description: 'Reviews code', filePath: '/home/.claude/agents/code-reviewer.md', color: '', tools: [], maxTurns: 0, memory: 'local' },
    ],
    isLoading: false,
  })),
}))

vi.mock('../api/usePlans', () => ({
  usePlans: vi.fn(() => ({
    data: [
      { filename: 'plan-a.md', title: 'Plan A', date: '2026-05-13', path: '/home/.claude/plans/plan-a.md', preview: '', modifiedAt: '' },
      { filename: 'plan-b.md', title: 'Plan B', date: '2026-05-12', path: '/home/.claude/plans/plan-b.md', preview: '', modifiedAt: '' },
    ],
    isLoading: false,
  })),
}))

vi.mock('../api/useSystem', () => ({
  useSystemHealth: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('../api/useKnowledge', () => ({
  useRules: vi.fn(() => ({ data: [], isLoading: false })),
  useSkills: vi.fn(() => ({ data: [], isLoading: false })),
  useCommands: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('../api/useMemory', () => ({
  useAgentMemory: vi.fn(() => ({ data: [], isLoading: false })),
  useProjectMemory: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('../api/useCastData', () => ({
  useChainMap: vi.fn(() => ({ data: null, isLoading: false })),
  usePolicies: vi.fn(() => ({ data: null, isLoading: false })),
  useModelPricing: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('../api/useParryGuard', () => ({
  useParryGuard: vi.fn(() => ({ data: { events: [] } })),
}))

vi.mock('../api/useAgentTruncations', () => ({
  useAgentTruncations: vi.fn(() => ({ data: { truncations: [] } })),
}))

vi.mock('../components/StatCard', () => ({
  default: () => <div data-testid="stat-card" />,
  StatCardSkeleton: () => <div data-testid="stat-card-skeleton" />,
}))

vi.mock('../api/useAgentRuns', () => ({ useAgentRuns: vi.fn(() => ({ data: null })) }))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

async function renderSystemView() {
  const { default: SystemView } = await import('./SystemView')
  const qc = makeQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <SystemView />
    </QueryClientProvider>
  )
}

// ── Cron fetch mock helpers ───────────────────────────────────────────────────

function mockCronFetch(entries: string[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/castd/status') {
      return {
        ok: true,
        json: async () => ({ entries, count: entries.length, running: false, pid: null }),
      } as Response
    }
    return { ok: true, json: async () => ({}) } as Response
  }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SystemView — CronTab → aria-labels on cron control buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function openCronTab(entries: string[] = ['0 * * * * /usr/bin/cast daily']) {
    mockCronFetch(entries)
    await renderSystemView()
    const cronTab = await screen.findByRole('button', { name: /cron/i })
    fireEvent.click(cronTab)
  }

  it('Play button has aria-label "Run cron entry now"', async () => {
    await openCronTab()
    const playBtn = await screen.findByRole('button', { name: 'Run cron entry now' })
    expect(playBtn).toBeInTheDocument()
  })

  it('Delete button has aria-label "Delete cron entry"', async () => {
    await openCronTab()
    const deleteBtn = await screen.findByRole('button', { name: 'Delete cron entry' })
    expect(deleteBtn).toBeInTheDocument()
  })

  it('shows no cron control buttons when entry list is empty', async () => {
    await openCronTab([])
    // Wait for the cron tab content to load (loading state resolves)
    await waitFor(() => {
      expect(screen.queryByText('Loading cron status...')).not.toBeInTheDocument()
    }, { timeout: 3000 })
    expect(screen.queryByRole('button', { name: 'Run cron entry now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete cron entry' })).not.toBeInTheDocument()
  })
})

describe('SystemView — AgentsTab → PreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders agent rows with buttons', async () => {
    await renderSystemView()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open agent definition: code-writer/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /open agent definition: code-reviewer/i })).toBeInTheDocument()
  })

  it('clicking an agent row opens PreviewModal with the agent filePath', async () => {
    await renderSystemView()
    const btn = await screen.findByRole('button', { name: /open agent definition: code-writer/i })
    fireEvent.click(btn)
    const modal = screen.getByTestId('preview-modal')
    expect(modal).toBeInTheDocument()
    expect(modal.getAttribute('data-path')).toBe('/home/.claude/agents/code-writer.md')
  })

  it('closing the modal removes it from the DOM', async () => {
    await renderSystemView()
    const btn = await screen.findByRole('button', { name: /open agent definition: code-writer/i })
    fireEvent.click(btn)
    const closeBtn = screen.getByRole('button', { name: /close preview/i })
    fireEvent.click(closeBtn)
    await waitFor(() => {
      expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument()
    })
  })
})

describe('SystemView — PlansTab → PreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function openPlansTab() {
    await renderSystemView()
    const plansTab = await screen.findByRole('button', { name: /plans/i })
    fireEvent.click(plansTab)
  }

  it('renders plan rows after switching to Plans tab', async () => {
    await openPlansTab()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open plan: plan a/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /open plan: plan b/i })).toBeInTheDocument()
  })

  it('clicking a plan row opens PreviewModal with the plan path', async () => {
    await openPlansTab()
    const btn = await screen.findByRole('button', { name: /open plan: plan a/i })
    fireEvent.click(btn)
    const modal = screen.getByTestId('preview-modal')
    expect(modal).toBeInTheDocument()
    expect(modal.getAttribute('data-path')).toBe('/home/.claude/plans/plan-a.md')
  })

  it('closing the modal removes it from the DOM', async () => {
    await openPlansTab()
    const btn = await screen.findByRole('button', { name: /open plan: plan a/i })
    fireEvent.click(btn)
    const closeBtn = screen.getByRole('button', { name: /close preview/i })
    fireEvent.click(closeBtn)
    await waitFor(() => {
      expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument()
    })
  })
})
