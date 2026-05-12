import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CastFsTree from './CastFsTree'
import type { FsItem, HookItem, PreviewTarget } from './CastFsTree'

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

// ── mock fetch ────────────────────────────────────────────────────────────────

const mockAgents: FsItem[] = [
  { name: 'code-writer', path: '/home/.claude/agents/code-writer.md', mtime: 1000 },
  { name: 'commit',      path: '/home/.claude/agents/commit.md',      mtime: 1001 },
]

const mockHooks: HookItem[] = [
  { event: 'PreToolUse', script: '/scripts/cast-guard.sh', enabled: true },
]

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderTree(onPreview: (t: PreviewTarget) => void = vi.fn(), qc?: QueryClient) {
  const client = qc ?? makeQueryClient()
  return {
    ...render(
      <QueryClientProvider client={client}>
        <CastFsTree onPreview={onPreview} />
      </QueryClientProvider>
    ),
    client,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('CastFsTree', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    // Default: all sections return empty array
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('/api/cast-fs/agents')) {
        return new Response(JSON.stringify(mockAgents), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    })
    // Reset to default expanded state (agents only)
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all 8 section headers', () => {
    renderTree()
    expect(screen.getByRole('button', { name: /agents section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /skills section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /rules section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /plans section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /commands section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /memory section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /hooks section/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /mcp section/i })).toBeTruthy()
  })

  it('agents section is expanded by default', () => {
    renderTree()
    const agentsButton = screen.getByRole('button', { name: /agents section/i })
    expect(agentsButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('clicking a collapsed section header expands it', async () => {
    renderTree()
    const skillsButton = screen.getByRole('button', { name: /skills section/i })
    // Skills starts collapsed
    expect(skillsButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(skillsButton)
    expect(skillsButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('clicking an expanded section header collapses it', () => {
    renderTree()
    const agentsButton = screen.getByRole('button', { name: /agents section/i })
    expect(agentsButton.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(agentsButton)
    expect(agentsButton.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders agent items when query resolves', async () => {
    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /preview agents item: commit/i })).toBeTruthy()
  })

  it('calls onPreview with {section, name, path} and trigger element when item is clicked', async () => {
    const onPreview = vi.fn()
    renderTree(onPreview)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview agents item: code-writer/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /preview agents item: code-writer/i }))
    expect(onPreview).toHaveBeenCalledWith(
      { section: 'agents', name: 'code-writer', path: '/home/.claude/agents/code-writer.md' },
      expect.any(HTMLButtonElement),
    )
  })

  it('subscribes to SSE on mount', () => {
    renderTree()
    expect(MockEventSource.instances.length).toBeGreaterThan(0)
    expect(MockEventSource.instances[0]?.url).toContain('/api/cast-fs/stream')
  })

  it('shows "No items" empty state when section is expanded and has no data', async () => {
    renderTree()
    const skillsButton = screen.getByRole('button', { name: /skills section/i })
    fireEvent.click(skillsButton)
    await waitFor(() => {
      expect(screen.getByText('No items')).toBeTruthy()
    })
  })

  it('hooks items have aria-disabled="true" and tabIndex=-1 (non-previewable)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('/api/cast-fs/hooks')) {
        return new Response(JSON.stringify(mockHooks), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    })
    renderTree()
    // Expand hooks section
    const hooksButton = screen.getByRole('button', { name: /hooks section/i })
    fireEvent.click(hooksButton)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview hooks item/i })).toBeTruthy()
    })
    const hookItemBtn = screen.getByRole('button', { name: /preview hooks item/i })
    expect(hookItemBtn.getAttribute('aria-disabled')).toBe('true')
    expect(hookItemBtn.getAttribute('tabindex')).toBe('-1')
  })
})
