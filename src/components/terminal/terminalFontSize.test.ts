import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  FONT_SIZE_KEY,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  clampFontSize,
  readFontSize,
  writeFontSize,
} from './terminalFontSize'

// ── localStorage mock (jsdom's built-in stub lacks .clear) ────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

describe('clampFontSize', () => {
  it('returns MIN when value is below MIN', () => {
    expect(clampFontSize(FONT_SIZE_MIN - 1)).toBe(FONT_SIZE_MIN)
  })

  it('returns MIN when value equals MIN', () => {
    expect(clampFontSize(FONT_SIZE_MIN)).toBe(FONT_SIZE_MIN)
  })

  it('returns MAX when value is above MAX', () => {
    expect(clampFontSize(FONT_SIZE_MAX + 1)).toBe(FONT_SIZE_MAX)
  })

  it('returns MAX when value equals MAX', () => {
    expect(clampFontSize(FONT_SIZE_MAX)).toBe(FONT_SIZE_MAX)
  })

  it('passes through in-range values unchanged', () => {
    expect(clampFontSize(13)).toBe(13)
    expect(clampFontSize(16)).toBe(16)
    expect(clampFontSize(20)).toBe(20)
  })
})

describe('readFontSize', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('returns DEFAULT when key is missing', () => {
    expect(readFontSize()).toBe(FONT_SIZE_DEFAULT)
  })

  it('returns DEFAULT when localStorage.getItem throws', () => {
    const original = localStorageMock.getItem
    localStorageMock.getItem = () => { throw new Error('storage unavailable') }
    try {
      expect(readFontSize()).toBe(FONT_SIZE_DEFAULT)
    } finally {
      localStorageMock.getItem = original
    }
  })

  it('returns DEFAULT when stored value is not a number ("abc")', () => {
    localStorageMock.setItem(FONT_SIZE_KEY, 'abc')
    expect(readFontSize()).toBe(FONT_SIZE_DEFAULT)
  })

  it('returns DEFAULT when stored value is empty string', () => {
    localStorageMock.setItem(FONT_SIZE_KEY, '')
    expect(readFontSize()).toBe(FONT_SIZE_DEFAULT)
  })

  it('returns the stored integer for a valid value', () => {
    localStorageMock.setItem(FONT_SIZE_KEY, '16')
    expect(readFontSize()).toBe(16)
  })

  it('clamps a stored value below MIN up to MIN', () => {
    localStorageMock.setItem(FONT_SIZE_KEY, '2')
    expect(readFontSize()).toBe(FONT_SIZE_MIN)
  })

  it('clamps a stored value above MAX down to MAX', () => {
    localStorageMock.setItem(FONT_SIZE_KEY, '99')
    expect(readFontSize()).toBe(FONT_SIZE_MAX)
  })
})

describe('writeFontSize', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('persists the clamped value to localStorage', () => {
    writeFontSize(15)
    expect(localStorageMock.getItem(FONT_SIZE_KEY)).toBe('15')
  })

  it('returns the clamped value', () => {
    expect(writeFontSize(15)).toBe(15)
  })

  it('clamps below-MIN input before storing', () => {
    const result = writeFontSize(1)
    expect(result).toBe(FONT_SIZE_MIN)
    expect(localStorageMock.getItem(FONT_SIZE_KEY)).toBe(String(FONT_SIZE_MIN))
  })

  it('clamps above-MAX input before storing', () => {
    const result = writeFontSize(100)
    expect(result).toBe(FONT_SIZE_MAX)
    expect(localStorageMock.getItem(FONT_SIZE_KEY)).toBe(String(FONT_SIZE_MAX))
  })

  it('round-trips with readFontSize', () => {
    writeFontSize(18)
    expect(readFontSize()).toBe(18)
  })

  it('returns clamped value even when localStorage.setItem throws', () => {
    const original = localStorageMock.setItem
    localStorageMock.setItem = () => { throw new Error('quota exceeded') }
    try {
      expect(writeFontSize(15)).toBe(15)
    } finally {
      localStorageMock.setItem = original
    }
  })
})
