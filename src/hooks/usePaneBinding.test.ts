import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { usePaneBinding } from './usePaneBinding'

// ── SseManager mock ───────────────────────────────────────────────────────────

type Handler = (e: unknown) => void
const capturedHandlers = new Map<string, Handler>()

vi.mock('../lib/SseManager', () => ({
  sseManager: {
    subscribe: vi.fn((type: string, h: Handler) => {
      capturedHandlers.set(type, h)
      return () => capturedHandlers.delete(type)
    }),
  },
  useEvent: vi.fn((type: string, h: Handler) => {
    capturedHandlers.set(type, h)
  }),
  useEventValue: vi.fn((_t: string, initial: unknown) => initial),
}))

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  capturedHandlers.clear()
  mockFetch.mockReset()
})

afterEach(() => {
  capturedHandlers.clear()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('usePaneBinding', () => {
  it('returns bound:false when paneId is undefined', () => {
    const qc = makeQueryClient()
    const { result } = renderHook(() => usePaneBinding(undefined), {
      wrapper: makeWrapper(qc),
    })

    expect(result.current.bound).toBe(false)
    expect(result.current.sessionId).toBeNull()
    expect(result.current.projectPath).toBeNull()
    expect(result.current.endedAt).toBeNull()
    // fetch should not have been called
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns bound:false + null fields on 404', async () => {
    mockFetch.mockResolvedValue({
      status: 404,
      ok: false,
    })

    const qc = makeQueryClient()
    const { result } = renderHook(() => usePaneBinding('pane-abc'), {
      wrapper: makeWrapper(qc),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/pane-bindings/pane-abc')
    })

    await waitFor(() => {
      expect(result.current.bound).toBe(false)
    })

    expect(result.current.sessionId).toBeNull()
    expect(result.current.projectPath).toBeNull()
    expect(result.current.endedAt).toBeNull()
  })

  it('returns bound:true + expected fields on 200', async () => {
    const bindingData = {
      paneId: 'pane-xyz',
      sessionId: 'sess-123456',
      startedAt: 1700000000,
      endedAt: null,
      projectPath: '/Users/ed/Projects/my-app',
    }

    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(bindingData),
    })

    const qc = makeQueryClient()
    const { result } = renderHook(() => usePaneBinding('pane-xyz'), {
      wrapper: makeWrapper(qc),
    })

    await waitFor(() => {
      expect(result.current.bound).toBe(true)
    })

    expect(result.current.sessionId).toBe('sess-123456')
    expect(result.current.projectPath).toBe('/Users/ed/Projects/my-app')
    expect(result.current.endedAt).toBeNull()
  })

  it('invalidates query when matching-paneId SSE event arrives', async () => {
    const bindingData = {
      paneId: 'pane-match',
      sessionId: 'sess-aabbcc',
      startedAt: 1700000000,
      endedAt: null,
      projectPath: '/some/path',
    }

    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(bindingData),
    })

    const qc = makeQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    renderHook(() => usePaneBinding('pane-match'), {
      wrapper: makeWrapper(qc),
    })

    await waitFor(() => {
      expect(capturedHandlers.has('pane_binding_updated')).toBe(true)
    })

    // Simulate SSE event with matching paneId via the captured useEvent handler
    const handler = capturedHandlers.get('pane_binding_updated')!
    handler({ type: 'pane_binding_updated', paneId: 'pane-match', sessionId: 'sess-new', projectPath: '/some/path', endedAt: null })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['paneBinding', 'pane-match'] })
    })
  })

  // ── Regression: staleTime + refetchInterval for new-tab binding delay ────────
  // Before the fix, staleTime was 60_000ms — a null result from a just-created
  // pane was cached for 60s. If the SSE pane_binding_updated event was missed
  // (connection not yet established), the panels stayed empty for 60s.
  //
  // After the fix:
  //   staleTime: 5_000         — null result expires after 5s, not 60s
  //   refetchInterval: 5_000   — polls every 5s while bound:false, stops once bound

  it('staleTime is 5_000ms — query config is not the 60_000ms pre-fix value (regression)', () => {
    // This test directly inspects the compiled query options to confirm the
    // staleTime regression is caught without relying on timer advancement.
    // It would have failed on the old code (staleTime: 60_000).
    const qc = makeQueryClient()
    const { unmount } = renderHook(() => usePaneBinding('pane-stale-check'), {
      wrapper: makeWrapper(qc),
    })

    // The query key is registered in the cache on mount; read its observer options.
    const cache = qc.getQueryCache()
    const query = cache.find({ queryKey: ['paneBinding', 'pane-stale-check'] })
    // staleTime is stored on the query's options (set by useQuery defaults)
    // TanStack Query uses Infinity as default; our hook overrides with 5_000.
    // The pre-fix value was 60_000 — this assertion catches a reversion.
    expect(query?.options.staleTime).toBeLessThanOrEqual(5_000)

    unmount()
  })

  it('polls every 5s while unbound then stops when bound (refetchInterval regression)', async () => {
    // First call: 404 (pane not yet bound). Second call: 200 with a sessionId.
    // The refetchInterval callback must return 5_000 when data has no sessionId,
    // and false once sessionId is present — stopping further polling.
    const bindingData = {
      paneId: 'pane-poll',
      sessionId: 'sess-poll-123',
      startedAt: 1700000000,
      endedAt: null,
      projectPath: '/some/path',
    }

    mockFetch
      .mockResolvedValueOnce({ status: 404, ok: false })
      .mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve(bindingData),
      })

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const qc = makeQueryClient()
      const { result, unmount } = renderHook(() => usePaneBinding('pane-poll'), {
        wrapper: makeWrapper(qc),
      })

      // Wait for first fetch (404) to resolve — bound:false
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(result.current.bound).toBe(false)

      // Advance 5.1s — refetchInterval fires and second fetch resolves
      await vi.advanceTimersByTimeAsync(5_100)

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), { timeout: 3000 })

      // After second fetch (200) the hook must be bound
      await waitFor(() => expect(result.current.bound).toBe(true), { timeout: 3000 })
      expect(result.current.sessionId).toBe('sess-poll-123')

      unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores non-matching SSE events', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({
        paneId: 'pane-A',
        sessionId: 'sess-A',
        startedAt: 1700000000,
        endedAt: null,
        projectPath: '/path/A',
      }),
    })

    const qc = makeQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    renderHook(() => usePaneBinding('pane-A'), {
      wrapper: makeWrapper(qc),
    })

    await waitFor(() => {
      expect(capturedHandlers.has('pane_binding_updated')).toBe(true)
    })

    // Simulate SSE event with DIFFERENT paneId via the captured useEvent handler
    const handler = capturedHandlers.get('pane_binding_updated')!
    handler({ type: 'pane_binding_updated', paneId: 'pane-B', sessionId: 'sess-B', projectPath: '/path/B', endedAt: null })

    // Give microtasks a chance to run
    await new Promise((r) => setTimeout(r, 10))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
