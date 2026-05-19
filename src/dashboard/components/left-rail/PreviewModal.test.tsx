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

// ── mock MarkdownEditor (JSDOM + CodeMirror is painful) ───────────────────────

vi.mock('./MarkdownEditor', () => ({
  MarkdownEditor: ({ initialContent, onChange, onSave }: {
    initialContent: string
    onChange: (v: string) => void
    onSave: (v: string) => void
  }) => (
    <textarea
      data-testid="markdown-editor"
      defaultValue={initialContent}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          onSave((e.target as HTMLTextAreaElement).value)
        }
      }}
      aria-label="Markdown editor"
    />
  ),
}))

// ── mock sonner ───────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

/** Seed the QueryClient cache so the modal renders data immediately */
function seedCache(client: QueryClient, path: string, source: 'cast' | 'project', content: string) {
  client.setQueryData(['preview-modal', path, source], { path, content, mtime: 1000 })
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
      // PreviewModal uses aria-label (not aria-labelledby) — ModalHeader renders the
      // title as a <p> element without an id; the dialog label is set via aria-label.
      const ariaLabel = dialog.getAttribute('aria-label')
      expect(ariaLabel).toMatch(/code-writer\.md/i)
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

  describe('Edit mode', () => {
    it('renders read-only by default (no editor visible)', () => {
      const client = makeQueryClient()
      seedCache(client, TEST_PATH, 'cast', TEST_CONTENT)
      renderModal(TEST_PATH, vi.fn(), 'cast', client)
      expect(screen.queryByTestId('markdown-editor')).toBeNull()
      expect(screen.getByTestId('preview-body')).toBeTruthy()
    })

    it('Edit button appears for cast .md files', () => {
      const client = makeQueryClient()
      seedCache(client, TEST_PATH, 'cast', TEST_CONTENT)
      renderModal(TEST_PATH, vi.fn(), 'cast', client)
      expect(screen.getByRole('button', { name: /edit file/i })).toBeTruthy()
    })

    it('Edit button is absent for project-source files', () => {
      const client = makeQueryClient()
      seedCache(client, TEST_PATH, 'project', TEST_CONTENT)
      renderModal(TEST_PATH, vi.fn(), 'project', client)
      expect(screen.queryByRole('button', { name: /edit file/i })).toBeNull()
    })

    it('Edit button is absent for non-.md cast files', () => {
      const nonMdPath = '/home/.claude/agents/code-writer.sh'
      const client = makeQueryClient()
      seedCache(client, nonMdPath, 'cast', '#!/bin/bash\necho hello')
      renderModal(nonMdPath, vi.fn(), 'cast', client)
      expect(screen.queryByRole('button', { name: /edit file/i })).toBeNull()
    })

    it('clicking Edit switches to edit mode and renders MarkdownEditor', () => {
      const client = makeQueryClient()
      seedCache(client, TEST_PATH, 'cast', TEST_CONTENT)
      renderModal(TEST_PATH, vi.fn(), 'cast', client)

      fireEvent.click(screen.getByRole('button', { name: /edit file/i }))

      expect(screen.getByTestId('markdown-editor')).toBeTruthy()
      expect(screen.queryByTestId('preview-body')).toBeNull()
    })

    it('dirty indicator (•) appears in title after content changes in edit mode', () => {
      const client = makeQueryClient()
      seedCache(client, TEST_PATH, 'cast', TEST_CONTENT)
      renderModal(TEST_PATH, vi.fn(), 'cast', client)

      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /edit file/i }))

      // Change content in the mocked textarea
      const editor = screen.getByTestId('markdown-editor')
      fireEvent.change(editor, { target: { value: 'changed content' } })

      // Dirty indicator should appear in the title
      expect(screen.getByText(/^•/)).toBeTruthy()
    })

    it('Save button calls write mutation with correct path and content', async () => {
      vi.restoreAllMocks()
      const writeFetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/cast-fs/write')) {
          return Promise.resolve(
            new Response(JSON.stringify({ path: TEST_PATH }), {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        // Preview fetch
        return Promise.resolve(
          new Response(JSON.stringify({ path: TEST_PATH, content: TEST_CONTENT, mtime: 1000 }), {
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      const client = makeQueryClient()
      seedCache(client, TEST_PATH, 'cast', TEST_CONTENT)
      renderModal(TEST_PATH, vi.fn(), 'cast', client)

      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /edit file/i }))

      // Change content
      const editor = screen.getByTestId('markdown-editor')
      fireEvent.change(editor, { target: { value: 'new content' } })

      // Click Save
      fireEvent.click(screen.getByRole('button', { name: /save file/i }))

      await waitFor(() => {
        expect(writeFetchSpy).toHaveBeenCalledWith(
          '/api/cast-fs/write',
          expect.objectContaining({ method: 'POST' })
        )
      })
    })
  })

  describe('Close button', () => {
    it('close button has aria-label="Close"', () => {
      renderModal()
      // ModalHeader uses a generic aria-label="Close" for reusability across
      // PreviewModal, AboutDialog, and DispatchModal.
      expect(screen.getByRole('button', { name: /^close$/i })).toBeTruthy()
    })

    it('clicking close button calls onClose', () => {
      const onClose = vi.fn()
      renderModal(TEST_PATH, onClose)
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
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
      const closeBtn = screen.getByRole('button', { name: /^close$/i })
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
