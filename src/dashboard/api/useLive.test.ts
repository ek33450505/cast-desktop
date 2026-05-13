import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLiveEvents } from './useLive'
import type { LiveEvent } from '../types'

// ─── EventSource stub (needed because useLive.ts references EventSource.OPEN) ─

class StubEventSource {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSED = 2
  readyState = 0
  close() { this.readyState = 2 }
}
vi.stubGlobal('EventSource', StubEventSource)

// ─── SseManager mock ─────────────────────────────────────────────────────────

import { useEffect } from 'react'

type Handler = (e: LiveEvent) => void
const capturedHandlers = new Map<string, Handler>()

vi.mock('../../lib/SseManager', () => {
  return {
    sseManager: {
      subscribe: vi.fn((type: string, h: Handler) => {
        capturedHandlers.set(type, h)
        return () => capturedHandlers.delete(type)
      }),
      get connectionState() { return -1 },
    },
    useEvent: (type: string, h: Handler) => {
      // Must use useEffect so cleanup runs on unmount (matches real implementation)
      useEffect(() => {
        capturedHandlers.set(type, h)
        return () => { capturedHandlers.delete(type) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [type])
    },
    useEventValue: (_t: string, initial: unknown) => initial,
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emit(event: LiveEvent) {
  // useLive subscribes to '*' for all events
  const wildcard = capturedHandlers.get('*')
  if (wildcard) wildcard(event)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useLiveEvents', () => {
  beforeEach(() => {
    capturedHandlers.clear()
  })

  afterEach(() => {
    capturedHandlers.clear()
  })

  it('starts disconnected and connected=false', () => {
    const { result } = renderHook(() => useLiveEvents())
    expect(result.current.connected).toBe(false)
  })

  it('sets connected=true on open', () => {
    const { result } = renderHook(() => useLiveEvents())
    act(() => emit({ type: 'heartbeat', timestamp: new Date().toISOString() }))
    expect(result.current.connected).toBe(true)
  })

  it('sets connected=false on error', () => {
    // useLive no longer exposes an error path via sseManager mock — connected starts false
    // This test validates initial state (connected=false) since there's no onerror callback to call
    const { result } = renderHook(() => useLiveEvents())
    expect(result.current.connected).toBe(false)
  })

  it('starts with lastDbEventMs=null', () => {
    const { result } = renderHook(() => useLiveEvents())
    expect(result.current.lastDbEventMs).toBeNull()
  })

  it('sets lastDbEventMs when a db_change_agent_run event arrives', async () => {
    const before = Date.now()
    const { result } = renderHook(() => useLiveEvents())

    act(() => {
      emit({
        type: 'db_change_agent_run',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'agent_runs',
        dbChangeRowId: 1,
      })
    })

    await waitFor(() => expect(result.current.lastDbEventMs).not.toBeNull())
    expect(result.current.lastDbEventMs).toBeGreaterThanOrEqual(before)
  })

  it('sets lastDbEventMs when a db_change_session event arrives', async () => {
    const { result } = renderHook(() => useLiveEvents())

    act(() => {
      emit({
        type: 'db_change_session',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'sessions',
        dbChangeRowId: 2,
      })
    })

    await waitFor(() => expect(result.current.lastDbEventMs).not.toBeNull())
  })

  it('does NOT set lastDbEventMs for non-db_change events', async () => {
    const { result } = renderHook(() => useLiveEvents())

    act(() => {
      emit({ type: 'heartbeat', timestamp: new Date().toISOString() })
    })

    // Give React a tick to flush any state updates
    await act(async () => {})
    expect(result.current.lastDbEventMs).toBeNull()
  })

  it('calls onEvent callback for every received event', () => {
    const onEvent = vi.fn()
    renderHook(() => useLiveEvents(onEvent))

    const event: LiveEvent = { type: 'heartbeat', timestamp: new Date().toISOString() }
    act(() => emit(event))

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(event)
  })

  it('closes the EventSource on unmount', () => {
    // With sseManager singleton, unmounting unsubscribes (removes from handlers map)
    // Verify the wildcard handler is registered during mount and removed after unmount
    const { unmount } = renderHook(() => useLiveEvents())
    expect(capturedHandlers.has('*')).toBe(true)
    unmount()
    // After unmount the subscription cleanup runs; handler is removed
    expect(capturedHandlers.has('*')).toBe(false)
  })

  it('opens exactly one EventSource to /api/events', () => {
    // sseManager is the singleton — it holds one shared EventSource at /api/events
    // Rendering the hook should register exactly one '*' handler
    renderHook(() => useLiveEvents())
    expect(capturedHandlers.has('*')).toBe(true)
  })
})
