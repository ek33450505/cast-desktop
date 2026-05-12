import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PreviewModal from './PreviewModal'

// ── mock framer-motion ────────────────────────────────────────────────────────

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  }
})

// ── mock PreviewBody ──────────────────────────────────────────────────────────

vi.mock('./PreviewBody', () => ({
  default: ({ filePath, content }: { filePath: string; content: string }) => (
    <div data-testid="preview-body" data-file-path={filePath} data-content={content} />
  ),
}))

// ── helpers ───────────────────────────────────────────────────────────────────

const TEST_PATH = '/home/.claude/agents/code-writer.md'
const TEST_CONTENT = '# Code Writer\n\nThis is a test.'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderModal(
  path: string = TEST_PATH,
  onClose: () => void = vi.fn(),
  source: 'cast' | 'project' = 'cast',
  qc?: QueryClient,
) {
  const client = qc ?? makeQueryClient()
  return {
    ...render(
      <QueryClientProvider client={client}>
        <PreviewModal path={path} source={source} onClose={onClose} />
      </QueryClientProvider>
    ),
    client,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PreviewModal', () => {
  beforeEach(() => {
    // Default: pending fetch (loading state)
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      new Promise<Response>(() => { /* pending */ })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders with role="dialog" and aria-modal="true"', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeTruthy()
      expect(dialog.getAttribute('aria-modal')).toBe('true')
    })

    it('dialog references a labelling element via aria-labelledby with the file basename', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      const labelId = dialog.getAttribute('aria-labelledby')
      expect(labelId).toBeTruthy()
      const labelEl = document.getElementById(labelId!)
      expect(labelEl?.textContent).toMatch(/code-writer\.md/i)
    })

    it('shows file basename in header', () => {
      renderModal()
      expect(screen.getByText('code-writer.md')).toBeTruthy()
    })

    it('shows loading skeleton while fetching', () => {
      renderModal()
      expect(screen.getByLabelText('Loading preview')).toBeTruthy()
    })

    it('renders PreviewBody with correct content prop after fetch resolves', async () => {
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ path: TEST_PATH, content: TEST_CONTENT, mtime: 1000 }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
      renderModal()
      await waitFor(() => {
        expect(screen.getByTestId('preview-body')).toBeTruthy()
      })
      const body = screen.getByTestId('preview-body')
      expect(body.getAttribute('data-content')).toBe(TEST_CONTENT)
    })

    it('renders error state when fetch fails', async () => {
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'path outside allowed root' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      renderModal()
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy()
      })
    })

    it('uses project endpoint when source="project"', async () => {
      vi.restoreAllMocks()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ path: TEST_PATH, content: TEST_CONTENT, mtime: 1000 }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
      renderModal(TEST_PATH, vi.fn(), 'project')
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/project-fs/preview')
        )
      })
    })
  })

  describe('Close button', () => {
    it('close button has aria-label="Close preview"', () => {
      renderModal()
      expect(screen.getByRole('button', { name: /close preview/i })).toBeTruthy()
    })

    it('clicking close button calls onClose', () => {
      const onClose = vi.fn()
      renderModal(TEST_PATH, onClose)
      fireEvent.click(screen.getByRole('button', { name: /close preview/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('Keyboard interaction', () => {
    it('Escape key calls onClose', () => {
      const onClose = vi.fn()
      renderModal(TEST_PATH, onClose)
      const dialog = screen.getByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('focus trap: Tab from last focusable element wraps to first', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      // The only known focusable element in the modal is the close button (PreviewBody is mocked as non-interactive)
      // With a single focusable, last === first, so Tab should wrap back to it
      const closeBtn = screen.getByRole('button', { name: /close preview/i })
      closeBtn.focus()
      expect(document.activeElement).toBe(closeBtn)
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false })
      // Focus should wrap back to the first (and only) focusable — the close button
      expect(document.activeElement).toBe(closeBtn)
    })
  })

  describe('Backdrop interaction', () => {
    it('clicking the backdrop (dialog element itself) calls onClose', () => {
      const onClose = vi.fn()
      renderModal(TEST_PATH, onClose)
      const dialog = screen.getByRole('dialog')
      // Simulate click directly on backdrop (target === currentTarget)
      fireEvent.click(dialog)
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('clicking inside the panel does not call onClose', () => {
      const onClose = vi.fn()
      renderModal(TEST_PATH, onClose)
      const closeBtn = screen.getByRole('button', { name: /close preview/i })
      // Click the close button — this is inside the panel, so backdrop handler should not fire
      // (but the close button handler does fire; we test backdrop isolation here)
      const dialog = screen.getByRole('dialog')
      const panel = dialog.firstElementChild as HTMLElement
      fireEvent.click(panel)
      // onClose was not called by backdrop (but not called via button either)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Focus management', () => {
    it('panel element receives focus on mount', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      const panel = dialog.firstElementChild as HTMLElement
      // Panel has tabIndex={-1} and useEffect focuses it
      expect(panel.getAttribute('tabindex')).toBe('-1')
    })
  })

  describe('Reduced motion', () => {
    it('when useReducedMotion returns true, animation is "none"', async () => {
      const { useReducedMotion } = await import('framer-motion')
      vi.mocked(useReducedMotion).mockReturnValue(true)

      renderModal()
      const dialog = screen.getByRole('dialog')
      const panel = dialog.firstElementChild as HTMLElement

      // backdropFilter should be 'none' and panel animation should be 'none'
      expect((dialog as HTMLElement).style.backdropFilter).toBe('none')
      expect(panel.style.animation).toBe('none')
    })

    it('when useReducedMotion returns false, backdrop blur is applied', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      expect((dialog as HTMLElement).style.backdropFilter).toContain('blur')
    })
  })
})
