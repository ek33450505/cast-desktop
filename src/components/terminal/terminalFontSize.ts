export const FONT_SIZE_KEY = 'cast-terminal-font-size'
export const FONT_SIZE_DEFAULT = 13
export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 32

export function clampFontSize(size: number): number {
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, size))
}

export function readFontSize(): number {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY)
    if (!stored) return FONT_SIZE_DEFAULT
    const parsed = parseInt(stored, 10)
    return isNaN(parsed) ? FONT_SIZE_DEFAULT : clampFontSize(parsed)
  } catch {
    return FONT_SIZE_DEFAULT
  }
}

export function writeFontSize(size: number): number {
  const clamped = clampFontSize(size)
  try {
    localStorage.setItem(FONT_SIZE_KEY, String(clamped))
  } catch {
    // no-op: storage unavailable (SSR, restricted env, quota exceeded)
  }
  return clamped
}
