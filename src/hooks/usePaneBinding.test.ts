import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { usePaneBinding } from './usePaneBinding'

// ── EventSource mock ──────────────────────────────────────────────────────────

interface MockEventSourceInstance {
  url: string
  onmessage: ((e: MessageEvent) => void) | null
  close: () => void
}

let mockEventSourceInstances: MockEventSourceInstance[] = []

class MockEventSource {
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    mockEventSourceInstances.push(this)
  }

  close() {
    mockEventSourceInstances = mockEventSourceInstances.filter((i) => i !== this)
  }
}

vi.stubGlobal('EventSource', MockEventSource)

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
  mockEventSourceInstances = []
  mockFetch.mockReset()
})

afterEach(() => {
  mockEventSourceInstances = []
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
      expect(mockEventSourceInstances.length).toBeGreaterThan(0)
    })

    const es = mockEventSourceInstances[0]
    expect(es).toBeDefined()

    // Simulate SSE event with matching paneId
    const event = new MessageEvent('message', {
      data: JSON.stringify({ paneId: 'pane-match', sessionId: 'sess-new', projectPath: '/some/path', endedAt: null }),
    })
    es.onmessage?.(event)

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['paneBinding', 'pane-match'] })
    })
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
      expect(mockEventSourceInstances.length).toBeGreaterThan(0)
    })

    const es = mockEventSourceInstances[0]

    // Simulate SSE event with DIFFERENT paneId
    const event = new MessageEvent('message', {
      data: JSON.stringify({ paneId: 'pane-B', sessionId: 'sess-B', projectPath: '/path/B', endedAt: null }),
    })
    es.onmessage?.(event)

    // Give microtasks a chance to run
    await new Promise((r) => setTimeout(r, 10))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
