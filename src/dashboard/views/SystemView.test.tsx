import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// ── Tests ─────────────────────────────────────────────────────────────────────

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
