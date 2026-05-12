import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRailState, LEFT_RAIL_DEFAULT_PX, RIGHT_RAIL_DEFAULT_PX } from './useRailState'

const OPEN_KEY = 'cast-desktop:rail-state'
const LEFT_WIDTH_KEY = 'cast-desktop:left-rail-width'
const RIGHT_WIDTH_KEY = 'cast-desktop:right-rail-width'

// ──────────────────────────────────────────────────────────────────────────────
// Local localStorage mock — avoids relying on jsdom's partial Storage stub
// ──────────────────────────────────────────────────────────────────────────────
function makeMockStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
  }
}

describe('useRailState', () => {
  let mockStorage: ReturnType<typeof makeMockStorage>
  const originalLocalStorage = globalThis.localStorage

  beforeEach(() => {
    mockStorage = makeMockStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  // ── Default state ─────────────────────────────────────────────────────────

  it('defaults to left rail open and right rail COLLAPSED when localStorage is empty', () => {
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftRailOpen).toBe(true)
    // Right rail collapsed by default — terminal-first (spec Ed's call #1)
    expect(result.current.rightRailOpen).toBe(false)
  })

  it('defaults expanded widths to spec values when localStorage is empty', () => {
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftWidthPx).toBe(LEFT_RAIL_DEFAULT_PX)   // 260
    expect(result.current.rightWidthPx).toBe(RIGHT_RAIL_DEFAULT_PX) // 240
  })

  // ── Read persisted open/closed ────────────────────────────────────────────

  it('reads persisted open/closed values from localStorage on mount', () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === OPEN_KEY) return JSON.stringify({ leftRailOpen: false, rightRailOpen: true })
      return null
    })
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftRailOpen).toBe(false)
    expect(result.current.rightRailOpen).toBe(true)
  })

  it('falls back to defaults when localStorage contains corrupt JSON', () => {
    mockStorage.getItem.mockReturnValueOnce('not-valid-json{{{{')
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftRailOpen).toBe(true)
    expect(result.current.rightRailOpen).toBe(false)
  })

  // ── setLeftRailOpen / setRightRailOpen ────────────────────────────────────

  it('setLeftRailOpen(false) sets leftRailOpen to false and persists', () => {
    const { result } = renderHook(() => useRailState())

    act(() => {
      result.current.setLeftRailOpen(false)
    })

    expect(result.current.leftRailOpen).toBe(false)
    const calls = mockStorage.setItem.mock.calls.filter((c) => c[0] === OPEN_KEY)
    const lastCall = calls[calls.length - 1]
    const stored = JSON.parse(lastCall[1] as string)
    expect(stored.leftRailOpen).toBe(false)
  })

  it('setLeftRailOpen(true) sets leftRailOpen to true and persists', () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === OPEN_KEY) return JSON.stringify({ leftRailOpen: false, rightRailOpen: false })
      return null
    })
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftRailOpen).toBe(false)

    act(() => {
      result.current.setLeftRailOpen(true)
    })

    expect(result.current.leftRailOpen).toBe(true)
    const calls = mockStorage.setItem.mock.calls.filter((c) => c[0] === OPEN_KEY)
    const lastCall = calls[calls.length - 1]
    const stored = JSON.parse(lastCall[1] as string)
    expect(stored.leftRailOpen).toBe(true)
  })

  it('setRightRailOpen(true) sets rightRailOpen to true and persists', () => {
    const { result } = renderHook(() => useRailState())
    // right rail defaults to false
    act(() => {
      result.current.setRightRailOpen(true)
    })

    expect(result.current.rightRailOpen).toBe(true)
    const calls = mockStorage.setItem.mock.calls.filter((c) => c[0] === OPEN_KEY)
    const lastCall = calls[calls.length - 1]
    const stored = JSON.parse(lastCall[1] as string)
    expect(stored.rightRailOpen).toBe(true)
  })

  it('setRightRailOpen(false) sets rightRailOpen to false and persists', () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === OPEN_KEY) return JSON.stringify({ leftRailOpen: true, rightRailOpen: true })
      return null
    })
    const { result } = renderHook(() => useRailState())
    expect(result.current.rightRailOpen).toBe(true)

    act(() => {
      result.current.setRightRailOpen(false)
    })

    expect(result.current.rightRailOpen).toBe(false)
    const calls = mockStorage.setItem.mock.calls.filter((c) => c[0] === OPEN_KEY)
    const lastCall = calls[calls.length - 1]
    const stored = JSON.parse(lastCall[1] as string)
    expect(stored.rightRailOpen).toBe(false)
  })

  // ── Width persistence ─────────────────────────────────────────────────────

  it('setLeftWidthPx persists to left-rail-width key', () => {
    const { result } = renderHook(() => useRailState())

    act(() => {
      result.current.setLeftWidthPx(320)
    })

    expect(result.current.leftWidthPx).toBe(320)
    const calls = mockStorage.setItem.mock.calls.filter((c) => c[0] === LEFT_WIDTH_KEY)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[calls.length - 1][1]).toBe('320')
  })

  it('setRightWidthPx persists to right-rail-width key', () => {
    const { result } = renderHook(() => useRailState())

    act(() => {
      result.current.setRightWidthPx(280)
    })

    expect(result.current.rightWidthPx).toBe(280)
    const calls = mockStorage.setItem.mock.calls.filter((c) => c[0] === RIGHT_WIDTH_KEY)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[calls.length - 1][1]).toBe('280')
  })

  it('reads persisted widths from localStorage on mount', () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === LEFT_WIDTH_KEY) return '300'
      if (key === RIGHT_WIDTH_KEY) return '260'
      return null
    })
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftWidthPx).toBe(300)
    expect(result.current.rightWidthPx).toBe(260)
  })

  it('falls back to default widths when persisted value is corrupt', () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === LEFT_WIDTH_KEY) return 'not-a-number'
      if (key === RIGHT_WIDTH_KEY) return 'NaN'
      return null
    })
    const { result } = renderHook(() => useRailState())
    expect(result.current.leftWidthPx).toBe(LEFT_RAIL_DEFAULT_PX)
    expect(result.current.rightWidthPx).toBe(RIGHT_RAIL_DEFAULT_PX)
  })

  // ── Error tolerance ───────────────────────────────────────────────────────

  it('does not throw when localStorage.setItem throws (quota / privacy mode)', () => {
    mockStorage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const { result } = renderHook(() => useRailState())

    expect(() => {
      act(() => {
        result.current.setLeftRailOpen(false)
      })
    }).not.toThrow()

    // State still updates in memory even when the storage write fails
    expect(result.current.leftRailOpen).toBe(false)
  })
})
