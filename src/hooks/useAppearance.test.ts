import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getInitialAppearance, applyAppearance, useAppearance } from './useAppearance'

// ── localStorage mock ─────────────────────────────────────────────────────────

const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) }),
}

vi.stubGlobal('localStorage', localStorageMock)

// ── matchMedia mock ───────────────────────────────────────────────────────────

type MQListListener = (e: MediaQueryListEvent) => void
const mqListeners: MQListListener[] = []
let mockPrefersLight = false

function makeMockMQ(query: string) {
  return {
    matches: query === '(prefers-color-scheme: light)' ? mockPrefersLight : false,
    media: query,
    addEventListener: vi.fn((_: string, h: MQListListener) => { mqListeners.push(h) }),
    removeEventListener: vi.fn((_: string, h: MQListListener) => {
      const idx = mqListeners.indexOf(h)
      if (idx !== -1) mqListeners.splice(idx, 1)
    }),
    dispatchEvent: vi.fn(),
  }
}

vi.stubGlobal('matchMedia', vi.fn((q: string) => makeMockMQ(q)))

// ── helpers ───────────────────────────────────────────────────────────────────

function firePrefersColorSchemeChange(isLight: boolean) {
  const fakeEvent = { matches: isLight } as MediaQueryListEvent
  mqListeners.forEach(fn => fn(fakeEvent))
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear()
  vi.mocked(localStorageMock.getItem).mockImplementation((key: string) => mockStorage[key] ?? null)
  vi.mocked(localStorageMock.setItem).mockImplementation((key: string, value: string) => { mockStorage[key] = value })
  mqListeners.length = 0
  mockPrefersLight = false
  vi.mocked(window.matchMedia).mockImplementation((q: string) => makeMockMQ(q))
  document.documentElement.removeAttribute('data-appearance')
})

afterEach(() => {
  document.documentElement.removeAttribute('data-appearance')
})

// ── getInitialAppearance ──────────────────────────────────────────────────────

describe('getInitialAppearance', () => {
  it('returns "dawn" when localStorage has "dawn"', () => {
    mockStorage['cast.appearance'] = 'dawn'
    expect(getInitialAppearance()).toBe('dawn')
  })

  it('returns "dusk" when localStorage has "dusk"', () => {
    mockStorage['cast.appearance'] = 'dusk'
    expect(getInitialAppearance()).toBe('dusk')
  })

  it('respects prefers-color-scheme: light when no localStorage value', () => {
    mockPrefersLight = true
    vi.mocked(window.matchMedia).mockImplementation((q: string) => makeMockMQ(q))
    expect(getInitialAppearance()).toBe('dawn')
  })

  it('falls back to "dusk" when no localStorage and no light preference', () => {
    mockPrefersLight = false
    vi.mocked(window.matchMedia).mockImplementation((q: string) => makeMockMQ(q))
    expect(getInitialAppearance()).toBe('dusk')
  })

  it('ignores invalid localStorage values and uses system pref', () => {
    mockStorage['cast.appearance'] = 'invalid'
    mockPrefersLight = false
    vi.mocked(window.matchMedia).mockImplementation((q: string) => makeMockMQ(q))
    expect(getInitialAppearance()).toBe('dusk')
  })
})

// ── applyAppearance ───────────────────────────────────────────────────────────

describe('applyAppearance', () => {
  it('sets data-appearance="dawn" on documentElement for dawn', () => {
    applyAppearance('dawn')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dawn')
  })

  it('removes data-appearance attribute on documentElement for dusk', () => {
    document.documentElement.setAttribute('data-appearance', 'dawn')
    applyAppearance('dusk')
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
  })

  it('is idempotent — calling twice with same value is a no-op', () => {
    applyAppearance('dawn')
    applyAppearance('dawn')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dawn')
  })
})

// ── useAppearance ─────────────────────────────────────────────────────────────

describe('useAppearance', () => {
  it('returns initial appearance from localStorage', () => {
    mockStorage['cast.appearance'] = 'dawn'
    const { result } = renderHook(() => useAppearance())
    expect(result.current.appearance).toBe('dawn')
  })

  it('toggle() flips from dusk to dawn', () => {
    mockStorage['cast.appearance'] = 'dusk'
    const { result } = renderHook(() => useAppearance())
    act(() => { result.current.toggle() })
    expect(result.current.appearance).toBe('dawn')
  })

  it('toggle() flips from dawn to dusk', () => {
    mockStorage['cast.appearance'] = 'dawn'
    const { result } = renderHook(() => useAppearance())
    act(() => { result.current.toggle() })
    expect(result.current.appearance).toBe('dusk')
  })

  it('toggle() persists to localStorage', () => {
    mockStorage['cast.appearance'] = 'dusk'
    const { result } = renderHook(() => useAppearance())
    act(() => { result.current.toggle() })
    expect(localStorageMock.setItem).toHaveBeenCalledWith('cast.appearance', 'dawn')
  })

  it('setAppearance() applies attribute to documentElement', () => {
    const { result } = renderHook(() => useAppearance())
    act(() => { result.current.setAppearance('dawn') })
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dawn')
  })

  it('setAppearance("dusk") removes data-appearance attribute', () => {
    document.documentElement.setAttribute('data-appearance', 'dawn')
    const { result } = renderHook(() => useAppearance())
    act(() => { result.current.setAppearance('dusk') })
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
  })

  it('auto-applies system pref change when no manual override', () => {
    // No localStorage key set
    const { result } = renderHook(() => useAppearance())
    act(() => { firePrefersColorSchemeChange(true) })
    expect(result.current.appearance).toBe('dawn')
  })

  it('ignores system pref change when manual override is set', () => {
    mockStorage['cast.appearance'] = 'dusk'
    const { result } = renderHook(() => useAppearance())
    act(() => { firePrefersColorSchemeChange(true) })
    // Should stay dusk because manual override is set
    expect(result.current.appearance).toBe('dusk')
  })
})
