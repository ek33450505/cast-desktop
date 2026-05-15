/**
 * Tests for useFileWatch hook
 *
 * Covers:
 * 1. No-ops gracefully when Tauri plugin unavailable (browser dev mode)
 * 2. Calls onChange when file change event fires
 * 3. Debounces rapid events within 100ms
 * 4. Cleans up watchers on unmount
 * 5. Does nothing when paths is empty
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFileWatch } from './useFileWatch'

// Tauri plugin-fs mock
const mockUnwatch = vi.fn()
const mockWatch = vi.fn().mockResolvedValue(mockUnwatch)

vi.mock('@tauri-apps/plugin-fs', () => ({
  watch: mockWatch,
}))

beforeEach(() => {
  vi.useFakeTimers()
  mockWatch.mockReset()
  mockWatch.mockResolvedValue(mockUnwatch)
  mockUnwatch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFileWatch', () => {
  it('does nothing when paths is empty', async () => {
    const onChange = vi.fn()
    renderHook(() => useFileWatch({ paths: [], onChange }))
    await act(async () => { await vi.runAllTimersAsync() })
    expect(mockWatch).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sets up a watcher for each path', async () => {
    const onChange = vi.fn()
    const paths = ['/Users/ed/foo.ts', '/Users/ed/bar.ts']
    renderHook(() => useFileWatch({ paths, onChange }))
    // Wait for async watch setup
    await act(async () => { await Promise.resolve() })
    expect(mockWatch).toHaveBeenCalledTimes(2)
    expect(mockWatch).toHaveBeenCalledWith('/Users/ed/foo.ts', expect.any(Function))
    expect(mockWatch).toHaveBeenCalledWith('/Users/ed/bar.ts', expect.any(Function))
  })

  it('calls onChange after debounce window', async () => {
    const onChange = vi.fn()
    const paths = ['/Users/ed/foo.ts']

    renderHook(() => useFileWatch({ paths, onChange, debounceMs: 100 }))

    // Wait for watch setup
    await act(async () => { await Promise.resolve() })

    // Simulate a file event on the first registered watch callback
    const watchCallback = mockWatch.mock.calls[0]?.[1]
    expect(watchCallback).toBeDefined()

    act(() => {
      watchCallback({ type: 'Modify' })
    })

    // Before debounce window — should not have called onChange
    expect(onChange).not.toHaveBeenCalled()

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('/Users/ed/foo.ts')
  })

  it('debounces rapid events — only calls onChange once', async () => {
    const onChange = vi.fn()
    const paths = ['/Users/ed/foo.ts']

    renderHook(() => useFileWatch({ paths, onChange, debounceMs: 100 }))
    await act(async () => { await Promise.resolve() })

    const watchCallback = mockWatch.mock.calls[0]?.[1]

    act(() => {
      // Fire 5 rapid events
      watchCallback({ type: 'Modify' })
      watchCallback({ type: 'Modify' })
      watchCallback({ type: 'Modify' })
      watchCallback({ type: 'Modify' })
      watchCallback({ type: 'Modify' })
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Despite 5 events, onChange called only once
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('calls unwatch on unmount', async () => {
    // This test needs real timers so waitFor can poll until setupWatchers resolves.
    vi.useRealTimers()

    const onChange = vi.fn()
    const { unmount } = renderHook(() =>
      useFileWatch({ paths: ['/Users/ed/foo.ts'], onChange })
    )

    // Wait enough real time for the async setupWatchers chain (dynamic import
    // + await watch(...) + push to unwatchFns) to complete fully.
    await new Promise((r) => setTimeout(r, 50))

    expect(mockWatch).toHaveBeenCalledWith('/Users/ed/foo.ts', expect.any(Function))
    expect(mockUnwatch).not.toHaveBeenCalled()
    unmount()
    // Cleanup runs synchronously and iterates unwatchFns
    await new Promise((r) => setTimeout(r, 0))
    expect(mockUnwatch).toHaveBeenCalled()
  })

  it('gracefully no-ops if Tauri plugin throws on import', async () => {
    // Temporarily override mock to throw
    mockWatch.mockRejectedValueOnce(new Error('Plugin unavailable'))
    const onChange = vi.fn()

    // Should not throw
    expect(() => {
      renderHook(() => useFileWatch({ paths: ['/Users/ed/foo.ts'], onChange }))
    }).not.toThrow()

    await act(async () => { await Promise.resolve() })
    expect(onChange).not.toHaveBeenCalled()
  })
})
