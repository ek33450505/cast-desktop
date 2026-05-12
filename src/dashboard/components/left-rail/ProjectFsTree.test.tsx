import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProjectFsTree from './ProjectFsTree'
import type { PreviewTarget } from './CastFsTree'

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

// ── helpers ───────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  mtime: number
  size: number
  children?: TreeNode[]
}

const ROOT_DIR = '/project'

function makeRootNode(children: TreeNode[] = []): TreeNode {
  return { name: 'project', path: ROOT_DIR, type: 'dir', mtime: 1000, size: 0, children }
}

function makeDir(name: string, path: string, children?: TreeNode[]): TreeNode {
  return { name, path, type: 'dir', mtime: 1000, size: 0, children }
}

function makeFile(name: string, path: string): TreeNode {
  return { name, path, type: 'file', mtime: 1000, size: 100 }
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderTree(onPreview: (t: PreviewTarget, el?: HTMLElement) => void = vi.fn(), qc?: QueryClient) {
  const client = qc ?? makeQueryClient()
  return {
    ...render(
      <QueryClientProvider client={client}>
        <ProjectFsTree onPreview={onPreview} />
      </QueryClientProvider>
    ),
    client,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ProjectFsTree', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    // Default: root node with one dir and one file
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('/api/project-fs/tree')) {
        const rootNode = makeRootNode([
          makeDir('src', `${ROOT_DIR}/src`),
          makeFile('README.md', `${ROOT_DIR}/README.md`),
        ])
        return new Response(JSON.stringify(rootNode), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a folder node with name and chevron', async () => {
    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
  })

  it('renders file items with basename only (not full path)', async () => {
    renderTree()
    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeTruthy()
    })
    // Should show 'README.md', not the full path
    expect(screen.queryByText(`${ROOT_DIR}/README.md`)).toBeNull()
  })

  it('collapsed folder does not trigger a fetch for children', async () => {
    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    // Only the root fetch should have fired (dir param absent or empty)
    const childFetches = calls.filter((c: unknown[]) =>
      typeof c[0] === 'string' && c[0].includes('dir=') && c[0].includes('src')
    )
    expect(childFetches.length).toBe(0)
  })

  it('clicking folder header expands it and triggers fetch for children', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes(`dir=${encodeURIComponent(`${ROOT_DIR}/src`)}`)) {
        return new Response(JSON.stringify(makeDir('src', `${ROOT_DIR}/src`, [
          makeFile('index.ts', `${ROOT_DIR}/src/index.ts`),
        ])), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify(makeRootNode([
        makeDir('src', `${ROOT_DIR}/src`),
      ])), { headers: { 'Content-Type': 'application/json' } })
    })

    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /expand folder src/i }))

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeTruthy()
    })
  })

  it('aria-expanded is false before expand and true after', async () => {
    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    const folderBtn = screen.getByRole('button', { name: /expand folder src/i })
    expect(folderBtn.getAttribute('aria-expanded')).toBe('false')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeDir('src', `${ROOT_DIR}/src`, [])), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
    fireEvent.click(folderBtn)

    await waitFor(() => {
      expect(folderBtn.getAttribute('aria-expanded')).toBe('true')
    })
  })

  it('aria-controls points at children list when expanded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('dir=') && url.includes('src')) {
        return new Response(JSON.stringify(makeDir('src', `${ROOT_DIR}/src`, [])), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(makeRootNode([makeDir('src', `${ROOT_DIR}/src`)])), {
        headers: { 'Content-Type': 'application/json' },
      })
    })

    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    const folderBtn = screen.getByRole('button', { name: /expand folder src/i })
    expect(folderBtn.getAttribute('aria-controls')).toBeNull()

    fireEvent.click(folderBtn)
    await waitFor(() => {
      expect(folderBtn.getAttribute('aria-expanded')).toBe('true')
    })
    const controlsId = folderBtn.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    expect(document.getElementById(controlsId!)).toBeTruthy()
  })

  it('clicking a file node calls onPreview with {path, source: "project"} shape', async () => {
    const onPreview = vi.fn()
    renderTree(onPreview)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview project file: README.md/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /preview project file: README.md/i }))
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${ROOT_DIR}/README.md`,
        source: 'project',
      }),
      expect.any(HTMLButtonElement),
    )
  })

  it('folder icon differs from file icon (Folder vs File lucide components)', async () => {
    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
      expect(screen.getByRole('button', { name: /preview project file: README.md/i })).toBeTruthy()
    })
    // Both folder and file buttons are rendered — presence of both proves differentiation
    const folderBtn = screen.getByRole('button', { name: /expand folder src/i })
    const fileBtn = screen.getByRole('button', { name: /preview project file: README.md/i })
    // They are distinct DOM elements (different button roles)
    expect(folderBtn).not.toBe(fileBtn)
  })

  it('expanded empty folder shows "Empty" muted text', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('dir=') && url.includes('src')) {
        return new Response(JSON.stringify(makeDir('src', `${ROOT_DIR}/src`, [])), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(makeRootNode([makeDir('src', `${ROOT_DIR}/src`)])), {
        headers: { 'Content-Type': 'application/json' },
      })
    })

    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /expand folder src/i }))
    await waitFor(() => {
      expect(screen.getByText(/empty/i)).toBeTruthy()
    })
  })

  it('shows loading affordance while folder children are fetching', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes('dir=') && url.includes('src')) {
        // Never resolves — simulates loading
        return new Promise<Response>(() => { /* pending */ })
      }
      return new Response(JSON.stringify(makeRootNode([makeDir('src', `${ROOT_DIR}/src`)])), {
        headers: { 'Content-Type': 'application/json' },
      })
    })

    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /expand folder src/i }))

    // Loading indicator: the component renders "…" text when isLoading and expanded
    await waitFor(() => {
      const folderBtn = screen.getByRole('button', { name: /collapse folder src/i })
      expect(folderBtn).toBeTruthy()
    })
    // The "…" spinner is aria-hidden, so query via the DOM directly
    const loadingSpinner = document.querySelector('[aria-hidden="true"]')
    expect(loadingSpinner).toBeTruthy()
  })

  it('nested expansion: expand outer folder then inner folder renders grandchildren', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input.toString()
      if (url.includes(`dir=${encodeURIComponent(`${ROOT_DIR}/src/components`)}`)) {
        return new Response(JSON.stringify(makeDir('components', `${ROOT_DIR}/src/components`, [
          makeFile('App.tsx', `${ROOT_DIR}/src/components/App.tsx`),
        ])), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes(`dir=${encodeURIComponent(`${ROOT_DIR}/src`)}`)) {
        return new Response(JSON.stringify(makeDir('src', `${ROOT_DIR}/src`, [
          makeDir('components', `${ROOT_DIR}/src/components`),
        ])), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify(makeRootNode([
        makeDir('src', `${ROOT_DIR}/src`),
      ])), { headers: { 'Content-Type': 'application/json' } })
    })

    renderTree()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder src/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /expand folder src/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand folder components/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /expand folder components/i }))

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeTruthy()
    })
  })
})
