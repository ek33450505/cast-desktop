/**
 * Unit tests for useDeleteSession hook (write-layer Phase 4)
 *
 * Tests:
 * 1. Fires DELETE /api/sessions/:projectEncoded/:sessionId when mutate is called
 * 2. Resolves with { id, deleted_at } on success
 * 3. Throws (mutation enters error state) on non-ok response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useDeleteSession } from './useSessions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'not found' }),
  })
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useDeleteSession', () => {
  it('fires DELETE /api/sessions/:projectEncoded/:sessionId', async () => {
    const mockFetch = makeFetchOk({ id: 'sess-1', deleted_at: '2026-05-19T12:00:00Z' })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDeleteSession(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      result.current.mutate({ projectEncoded: 'my-project', sessionId: 'sess-1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/my-project/sess-1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('resolves with id and deleted_at on success', async () => {
    const payload = { id: 'sess-2', deleted_at: '2026-05-19T12:00:00Z' }
    vi.stubGlobal('fetch', makeFetchOk(payload))

    const { result } = renderHook(() => useDeleteSession(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      result.current.mutate({ projectEncoded: 'proj', sessionId: 'sess-2' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(payload)
  })

  it('enters error state on non-ok API response', async () => {
    vi.stubGlobal('fetch', makeFetchError())

    const { result } = renderHook(() => useDeleteSession(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      result.current.mutate({ projectEncoded: 'proj', sessionId: 'sess-3' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })
})
