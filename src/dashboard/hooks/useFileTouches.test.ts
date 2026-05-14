/**
 * Tests for useFileTouches hook
 *
 * Covers:
 * 1. Returns empty state when filePath is null
 * 2. Fetches touches for a valid absolute path
 * 3. Returns empty array + error on fetch failure
 * 4. Re-fetches when refresh() is called
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFileTouches } from './useFileTouches'

// Clear module-level cache between tests
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

const mockTouches = [
  { agent_name: 'code-writer', tool_name: 'write_file', ts: '2026-05-14T10:00:00Z', run_id: 'abc12345', line_range: null },
  { agent_name: 'debugger', tool_name: null, ts: '2026-05-14T09:00:00Z', run_id: null, line_range: null },
]

describe('useFileTouches', () => {
  it('returns empty state when filePath is null', () => {
    const { result } = renderHook(() => useFileTouches(null))
    expect(result.current.touches).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetches touches for a valid absolute path', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockTouches,
    } as Response)

    const { result } = renderHook(() => useFileTouches('/Users/ed/foo.ts'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.touches).toHaveLength(2)
    expect(result.current.touches[0].agent_name).toBe('code-writer')
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useFileTouches('/Users/ed/fetch-fail.ts'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.touches).toEqual([])
    expect(result.current.error).toMatch(/Network error/)
  })

  it('returns error when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response)

    const { result } = renderHook(() => useFileTouches('/Users/ed/http-500.ts'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.touches).toEqual([])
    expect(result.current.error).toMatch(/HTTP 500/)
  })

  it('refresh() clears cache and re-fetches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTouches,
    } as Response)

    const { result } = renderHook(() => useFileTouches('/Users/ed/refresh-test.ts'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.touches).toHaveLength(2)

    // Second fetch returns different data
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockTouches[0]],
    } as Response)

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.touches).toHaveLength(1)
  })
})
