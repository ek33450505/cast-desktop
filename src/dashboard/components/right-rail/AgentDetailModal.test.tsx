import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AgentDetailModal from './AgentDetailModal'

// ── Mock fetch ────────────────────────────────────────────────────────────────

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

interface RenderModalOptions {
  open?: boolean
  agentRunId?: string
  onClose?: () => void
}

function renderModal({ open = true, agentRunId = 'run-1', onClose = vi.fn() }: RenderModalOptions = {}) {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentDetailModal open={open} agentRunId={agentRunId} onClose={onClose} />
    </QueryClientProvider>
  )
}

function makeDetail(overrides: Partial<{
  agentRunId: string; name: string; model: string; prompt: string | null;
  startedAt: string; endedAt: string | null; status: string;
  inputTokens: number; outputTokens: number; costUsd: number
}> = {}) {
  return {
    agentRunId: 'run-1',
    name: 'code-writer',
    model: 'claude-sonnet-4-6',
    prompt: 'Implement LiveAgentsPanel for Wave 2.6 right rail',
    startedAt: '2026-05-12T10:00:00.000Z',
    endedAt: null,
    status: 'running',
    inputTokens: 1200,
    outputTokens: 800,
    costUsd: 0.0024,
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => makeDetail(),
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentDetailModal', () => {
  describe('Rendering', () => {
    it('renders nothing when open=false', () => {
      renderModal({ open: false })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog with role=dialog when open=true', async () => {
      renderModal()
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toBeInTheDocument()
    })

    it('has aria-modal="true"', async () => {
      renderModal()
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has aria-labelledby pointing at agent name h2', async () => {
      renderModal()
      const dialog = await screen.findByRole('dialog')
      const labelledBy = dialog.getAttribute('aria-labelledby')
      expect(labelledBy).toBeTruthy()

      const h2 = document.getElementById(labelledBy!)
      expect(h2).toBeTruthy()
      expect(await screen.findByText('code-writer')).toBeInTheDocument()
    })

    it('shows agent name in heading', async () => {
      renderModal()
      expect(await screen.findByText('code-writer')).toBeInTheDocument()
    })

    it('shows model badge with tier label', async () => {
      renderModal()
      // Wait for data to load
      await screen.findByText('code-writer')
      const badge = screen.getByLabelText('Model: sonnet')
      expect(badge).toBeInTheDocument()
    })

    it('shows full prompt text', async () => {
      renderModal()
      expect(await screen.findByText('Implement LiveAgentsPanel for Wave 2.6 right rail')).toBeInTheDocument()
    })

    it('shows status', async () => {
      renderModal()
      await screen.findByText('code-writer')
      expect(screen.getByText('running')).toBeInTheDocument()
    })

    it('shows token counts', async () => {
      renderModal()
      await screen.findByText('code-writer')
      expect(screen.getByText('1,200')).toBeInTheDocument()
      expect(screen.getByText('800')).toBeInTheDocument()
    })

    it('shows cost when non-zero', async () => {
      renderModal()
      await screen.findByText('code-writer')
      expect(screen.getByText('$0.0024')).toBeInTheDocument()
    })

    it('does not show cost row when costUsd is 0', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeDetail({ costUsd: 0 }),
      })
      renderModal()
      await screen.findByText('code-writer')
      expect(screen.queryByText('Cost')).not.toBeInTheDocument()
    })

    it('shows prompt as selectable text (not in input)', async () => {
      renderModal()
      const promptEl = await screen.findByText('Implement LiveAgentsPanel for Wave 2.6 right rail')
      expect(promptEl.tagName).not.toBe('INPUT')
      expect(promptEl.tagName).not.toBe('TEXTAREA')
    })
  })

  describe('Close behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn()
      renderModal({ onClose })

      await screen.findByRole('dialog')

      const closeBtn = screen.getByRole('button', { name: 'Close agent detail' })
      fireEvent.click(closeBtn)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose on Escape key', async () => {
      const onClose = vi.fn()
      renderModal({ onClose })

      const dialog = await screen.findByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when clicking backdrop', async () => {
      const onClose = vi.fn()
      renderModal({ onClose })

      await screen.findByRole('dialog')

      // The backdrop is the outer div that contains the dialog
      const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
      expect(backdrop).toBeTruthy()
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does NOT call onClose when clicking inside dialog', async () => {
      const onClose = vi.fn()
      renderModal({ onClose })

      const dialog = await screen.findByRole('dialog')
      fireEvent.click(dialog)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      })

      renderModal()

      await screen.findByRole('dialog')
      expect(await screen.findByText('Failed to load agent run details.')).toBeInTheDocument()
    })
  })
})
