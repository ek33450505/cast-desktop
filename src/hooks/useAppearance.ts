import { useState, useEffect, useCallback } from 'react'

export type Appearance = 'dawn' | 'dusk'

const STORAGE_KEY = 'cast.appearance'

/**
 * Read localStorage and/or prefers-color-scheme to determine initial appearance.
 * Priority: localStorage override > prefers-color-scheme > dusk (default).
 */
export function getInitialAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dawn' || stored === 'dusk') {
      return stored
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — continue to system pref
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'dawn'
  }

  return 'dusk'
}

/**
 * Apply appearance to the document root element.
 * - dawn: sets data-appearance="dawn" on <html>
 * - dusk: removes data-appearance (dusk is the :root default)
 *
 * Idempotent — safe to call multiple times with the same value.
 */
export function applyAppearance(a: Appearance): void {
  if (typeof document === 'undefined') return

  if (a === 'dawn') {
    document.documentElement.setAttribute('data-appearance', 'dawn')
  } else {
    document.documentElement.removeAttribute('data-appearance')
  }
}

/**
 * useAppearance — manages dawn/dusk appearance state.
 *
 * - Reads from localStorage on mount (done eagerly before createRoot for FOUA prevention)
 * - Persists changes to localStorage
 * - Listens to prefers-color-scheme changes (only auto-applies when no manual override)
 */
export function useAppearance(): {
  appearance: Appearance
  setAppearance: (a: Appearance) => void
  toggle: () => void
} {
  const [appearance, setAppearanceState] = useState<Appearance>(getInitialAppearance)

  const setAppearance = useCallback((a: Appearance) => {
    applyAppearance(a)
    setAppearanceState(a)
    try {
      localStorage.setItem(STORAGE_KEY, a)
    } catch {
      // Private mode — toggle still works in-memory for the session
    }
  }, [])

  const toggle = useCallback(() => {
    setAppearance(appearance === 'dawn' ? 'dusk' : 'dawn')
  }, [appearance, setAppearance])

  // Listen for OS preference changes — only auto-apply when no manual override
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent) => {
      let hasOverride = false
      try {
        hasOverride = localStorage.getItem(STORAGE_KEY) !== null
      } catch {
        // ignore
      }
      if (!hasOverride) {
        const next: Appearance = e.matches ? 'dawn' : 'dusk'
        applyAppearance(next)
        setAppearanceState(next)
      }
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Sync DOM on initial mount (handles the case where StrictMode double-invokes)
  useEffect(() => {
    applyAppearance(appearance)
  }, [appearance])

  return { appearance, setAppearance, toggle }
}
