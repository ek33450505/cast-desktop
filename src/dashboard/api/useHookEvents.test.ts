/**
 * Regression tests for useHookEventsStream bugs
 *
 * Bug: `connected` was set to true only when a hook_event SSE message arrived.
 * An open-but-quiet connection always showed "disconnected."
 * Fix: poll sseManager.connectionState every 1 s; `connected` now reflects
 * the actual transport state, not message receipt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHookEventsStream } from './useHookEvents'
import type { LiveEvent } from '../types'
import { useEffect } from 'react'

// ── EventSource stub ──────────────────────────────────────────────────────────

class StubEventSource {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSED = 2
  readyState = 0
  close() { this.readyState = 2 }
}
vi.stubGlobal('EventSource', StubEventSource)

// ── Controllable SseManager mock ──────────────────────────────────────────────

type Handler = (e: LiveEvent) => void
const capturedHandlers = new Map<string, Handler>()
let mockConnectionState = -1  // disconnected by default

vi.mock('../../lib/SseManager', () => {
  return {
    sseManager: {
      subscribe: vi.fn((type: string, h: Handler) => {
        capturedHandlers.set(type, h)
        return () => capturedHandlers.delete(type)
      }),
      get connectionState() { return mockConnectionState },
    },
    useEvent: (type: string, h: Handler) => {
      useEffect(() => {
        capturedHandlers.set(type, h)
        return () => { capturedHandlers.delete(type) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [type])
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function emitHookEvent() {
  const handler = capturedHandlers.get('hook_event')
  if (handler) {
    handler({
      type: 'hook_event',
      timestamp: new Date().toISOString(),
      hookEventName: 'PreToolUse',
      hookAgentId: 'agent-123',
    } as LiveEvent)
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useHookEventsStream — connection state (bug regression)', () => {
  beforeEach(() => {
    capturedHandlers.clear()
    mockConnectionState = -1
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts disconnected when EventSource is not yet open', () => {
    mockConnectionState = StubEventSource.CONNECTING
    const { result } = renderHook(() => useHookEventsStream())
    expect(result.current.connected).toBe(false)
  })

  it('becomes connected when sseManager.connectionState is OPEN — without needing a hook_event', async () => {
    // This is the core regression: before the fix, connected stayed false until
    // a hook_event message arrived even though the connection was open.
    mockConnectionState = StubEventSource.OPEN  // connection open, no events yet
    const { result } = renderHook(() => useHookEventsStream())

    // Advance the 1-second poll timer
    act(() => { vi.advanceTimersByTime(1_000) })

    expect(result.current.connected).toBe(true)
  })

  it('reflects disconnected state when EventSource closes mid-session', () => {
    mockConnectionState = StubEventSource.OPEN
    const { result } = renderHook(() => useHookEventsStream())
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(result.current.connected).toBe(true)

    // Simulate connection drop
    mockConnectionState = -1
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(result.current.connected).toBe(false)
  })

  it('appends events to the ring buffer when hook_event messages arrive', () => {
    mockConnectionState = StubEventSource.OPEN
    const { result } = renderHook(() => useHookEventsStream())

    act(() => { emitHookEvent() })

    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0].hook_type).toBe('PreToolUse')
  })

  it('does NOT require a hook_event to flip connected (regression guard)', () => {
    // Old code: setConnected(true) lived inside the hook_event handler.
    // Even with OPEN state and no events, connected must now be true.
    mockConnectionState = StubEventSource.OPEN
    const { result } = renderHook(() => useHookEventsStream())

    // No emitHookEvent() call — just advance the poll
    act(() => { vi.advanceTimersByTime(1_000) })

    expect(result.current.connected).toBe(true)
    expect(result.current.events).toHaveLength(0)
  })
})
