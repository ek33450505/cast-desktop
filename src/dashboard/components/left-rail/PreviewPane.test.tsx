import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PreviewPane from './PreviewPane'

// ── mock useReducedMotion ──────────────────────────────────────────────────────

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  }
})

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderPane(filePath: string, onClose: () => void = vi.fn(), qc?: QueryClient) {
  const client = qc ?? makeQueryClient()
  return {
    ...render(
      <QueryClientProvider client={client}>
        <PreviewPane path={filePath} onClose={onClose} />
      </QueryClientProvider>
    ),
    client,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PreviewPane', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      // Default: pending (no immediate response)
      return new Promise(() => { /* never resolves in loading tests */ })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Loading state', () => {
    it('renders loading skeleton while fetching', () => {
      renderPane('/home/.claude/agents/code-writer.md')
      expect(screen.getByLabelText('Loading preview')).toBeTruthy()
    })

    it('shows file basename in header even while loading', () => {
      renderPane('/home/.claude/agents/code-writer.md')
      expect(screen.getByText('code-writer.md')).toBeTruthy()
    })
  })

  describe('Content rendering', () => {
    it('renders file content after successful fetch', async () => {
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          path: '/home/.claude/agents/code-writer.md',
          content: '# Code Writer\n\nThis is a test agent.',
          mtime: 1000,
        }), { headers: { 'Content-Type': 'application/json' } })
      )
      renderPane('/home/.claude/agents/code-writer.md')
      await waitFor(() => {
        expect(screen.getByText('Code Writer')).toBeTruthy()
      })
      expect(screen.getByText('This is a test agent.')).toBeTruthy()
    })

    it('parses frontmatter into metadata bar', async () => {
      vi.restoreAllMocks()
      const content = `---
name: code-writer
type: feedback
description: A test agent for writing code
---

Some body text here.`
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          path: '/home/.claude/agents/code-writer.md',
          content,
          mtime: 1000,
        }), { headers: { 'Content-Type': 'application/json' } })
      )
      renderPane('/home/.claude/agents/code-writer.md')
      await waitFor(() => {
        expect(screen.getByText('code-writer')).toBeTruthy()
      })
      expect(screen.getByText('feedback')).toBeTruthy()
      expect(screen.getByText('A test agent for writing code')).toBeTruthy()
      expect(screen.getByText('Some body text here.')).toBeTruthy()
    })

    it('renders non-markdown files as preformatted text', async () => {
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          path: '/home/.claude/settings.json',
          content: '{"version": 1}',
          mtime: 1000,
        }), { headers: { 'Content-Type': 'application/json' } })
      )
      renderPane('/home/.claude/settings.json')
      await waitFor(() => {
        expect(screen.getByLabelText('File content')).toBeTruthy()
      })
      expect(screen.getByText('{"version": 1}')).toBeTruthy()
    })

    it('renders error state when fetch fails', async () => {
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'path outside allowed root' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      renderPane('/etc/passwd')
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy()
      })
    })
  })

  describe('Malformed YAML fallback', () => {
    it('renders alert banner and pre block when frontmatter is malformed', async () => {
      vi.restoreAllMocks()
      // Malformed frontmatter: unclosed array bracket
      const malformedContent = '---\nname: foo\nbroken: [unclosed\n---\nbody text here'
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          path: '/home/.claude/agents/bad.md',
          content: malformedContent,
          mtime: 1000,
        }), { headers: { 'Content-Type': 'application/json' } })
      )
      renderPane('/home/.claude/agents/bad.md')
      await waitFor(() => {
        // Should render the alert banner
        expect(screen.getByRole('alert')).toBeTruthy()
      })
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toMatch(/frontmatter could not be parsed/i)
      // Content should appear in a <pre> block, not through react-markdown
      expect(screen.getByLabelText('File content')).toBeTruthy()
    })
  })

  describe('Interaction', () => {
    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn()
      renderPane('/home/.claude/agents/code-writer.md', onClose)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when back button is clicked', () => {
      const onClose = vi.fn()
      renderPane('/home/.claude/agents/code-writer.md', onClose)
      fireEvent.click(screen.getByRole('button', { name: /back to file tree/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
