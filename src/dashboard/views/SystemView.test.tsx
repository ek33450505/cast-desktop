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

