import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useModelPricing } from '../api/useCastData'

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

// useCostSummary is used by PricingTab — provide a default mock
vi.mock('../api/useCostSummary', () => ({
  useCostSummary: vi.fn(() => ({ data: null, isLoading: false, isError: false })),
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

// ── Rate Card Bug Fix Tests ────────────────────────────────────────────────────

const MOCK_PRICING_WITH_ENVELOPE = {
  _comment: 'CAST model pricing config.',
  _note: 'Cloud costs reflect Anthropic published pricing.',
  models: {
    'claude-opus-4-5': { cost_per_million_input: 15, cost_per_million_output: 75, tier: 'cloud', provider: 'anthropic' },
    'claude-sonnet-4-6': { cost_per_million_input: 3, cost_per_million_output: 15, tier: 'cloud', provider: 'anthropic' },
  },
}

describe('SystemView — PricingTab rate card', () => {
  const mockUseModelPricing = useModelPricing as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCronFetch([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function openPricingTab() {
    await renderSystemView()
    const pricingTab = await screen.findByRole('button', { name: /pricing/i })
    fireEvent.click(pricingTab)
  }

  it('renders real model names (not _comment / _note / models keys)', async () => {
    mockUseModelPricing.mockReturnValue({ data: MOCK_PRICING_WITH_ENVELOPE, isLoading: false })
    await openPricingTab()
    expect(await screen.findByText('claude-opus-4-5')).toBeInTheDocument()
    expect(await screen.findByText('claude-sonnet-4-6')).toBeInTheDocument()
  })

  it('does not render _comment as a table row', async () => {
    mockUseModelPricing.mockReturnValue({ data: MOCK_PRICING_WITH_ENVELOPE, isLoading: false })
    await openPricingTab()
    // Wait for pricing content to settle
    await screen.findByText('claude-opus-4-5')
    expect(screen.queryByText('_comment')).not.toBeInTheDocument()
    expect(screen.queryByText('_note')).not.toBeInTheDocument()
    expect(screen.queryByText('models')).not.toBeInTheDocument()
  })

  it('shows "No pricing data" when pricing is empty', async () => {
    mockUseModelPricing.mockReturnValue({ data: {}, isLoading: false })
    await openPricingTab()
    expect(await screen.findByText(/No pricing data/i)).toBeInTheDocument()
  })
})

