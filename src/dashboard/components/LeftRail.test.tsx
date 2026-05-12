import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LeftRail from './LeftRail'

// ── mock framer-motion ────────────────────────────────────────────────────────

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => true), // skip animations in tests
  }
})

// ── mock EventSource ──────────────────────────────────────────────────────────

class MockEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null
  static instances: MockEventSource[] = []
  constructor(public url: string) {
    MockEventSource.instances.push(this)
  }
  close() {
    MockEventSource.instances = MockEventSource.instances.filter(i => i !== this)
  }
}
vi.stubGlobal('EventSource', MockEventSource)

// ── mock localStorage ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const mockAgents = [
  { name: 'code-writer', path: '/home/.claude/agents/code-writer.md', mtime: 1000 },
]

function renderRail() {
  const qc = makeQueryClient()
  const onExpand = vi.fn()
  const result = render(
    <QueryClientProvider client={qc}>
      <LeftRail open={true} onExpand={onExpand} />
    </QueryClientProvider>
  )
  return { ...result, qc, onExpand }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LeftRail — modal-opens-directly behavior', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    localStorageMock.clear()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('/api/cast-fs/agents')) {
        return new Response(JSON.stringify(mockAgents), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/api/cast-fs/preview')) {
        return new Response(JSON.stringify({
          path: '/home/.claude/agents/code-writer.md',
          content: '# Code Writer\nTest content.',
          mtime: 1000,
        }), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clicking a file opens the modal (not an inline pane)', async () => {
    renderRail()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
    })

    const triggerBtn = screen.getByRole('button', { name: /preview agents item: code-writer/i })
    fireEvent.click(triggerBtn)

    // Modal renders with role="dialog" — not an inline back-button pane
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    // No inline "back to file tree" button — that was PreviewPane
    expect(screen.queryByRole('button', { name: /back to file tree/i })).toBeNull()
  })

  it('tree remains visible while modal is open (modal is an overlay, not a replacement)', async () => {
    renderRail()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /preview agents item: code-writer/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    // The tree item is still in the DOM (tree not replaced by preview)
    expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
  })

  it('closing the modal via close button dismisses it and returns focus', async () => {
    renderRail()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
    })

    const triggerBtn = screen.getByRole('button', { name: /preview agents item: code-writer/i })
    fireEvent.click(triggerBtn)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    const closeBtn = screen.getByRole('button', { name: /close preview/i })

    await act(async () => {
      fireEvent.click(closeBtn)
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Modal is gone
    expect(screen.queryByRole('dialog')).toBeNull()

    // Tree item is still present
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
    })
  })
})
