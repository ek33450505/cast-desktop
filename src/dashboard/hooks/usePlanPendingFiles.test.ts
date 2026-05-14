/**
 * Tests for usePlanPendingFiles hook
 *
 * Covers:
 * 1. Returns empty Set initially
 * 2. Returns populated Set from API response
 * 3. Returns empty Set on fetch failure (graceful)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePlanPendingFiles } from './usePlanPendingFiles'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePlanPendingFiles', () => {
  it('returns empty Set before first fetch completes', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    const { result } = renderHook(() => usePlanPendingFiles())
    expect(result.current).toBeInstanceOf(Set)
    expect(result.current.size).toBe(0)
  })

  it('returns populated Set from API response', async () => {
    const paths = ['/Users/ed/project/src/foo.ts', '/Users/ed/project/bar.ts']
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => paths,
    } as Response)

    const { result } = renderHook(() => usePlanPendingFiles())

    await waitFor(() => {
      expect(result.current.size).toBe(2)
    })

    expect(result.current.has('/Users/ed/project/src/foo.ts')).toBe(true)
    expect(result.current.has('/Users/ed/project/bar.ts')).toBe(true)
  })

  it('returns empty Set on fetch failure (graceful)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => usePlanPendingFiles())

    // Give the microtask queue a chance to settle the rejected fetch.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current.size).toBe(0)
  })

  it('returns empty Set when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    const { result } = renderHook(() => usePlanPendingFiles())

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current.size).toBe(0)
  })
})
