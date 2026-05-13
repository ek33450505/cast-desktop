import { useSyncExternalStore, useEffect } from 'react'

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

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
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

// ── Shared module-level store ─────────────────────────────────────────────────
// All useAppearance() consumers subscribe to the same state. When any consumer
// calls setAppearance or toggle, all others re-render synchronously.

let current: Appearance = getInitialAppearance()
const subs = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  subs.add(cb)
  return () => subs.delete(cb)
}

function getSnapshot(): Appearance {
  return current
}

function setShared(a: Appearance): void {
  current = a
  applyAppearance(a)
  try {
    localStorage.setItem(STORAGE_KEY, a)
  } catch {
    // Private mode — toggle still works in-memory for the session
  }
  subs.forEach((cb) => cb())
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAppearance — manages dawn/dusk appearance state.
 *
 * Uses a shared module-level store via useSyncExternalStore so ALL consumers
 * (AppearanceToggle, TerminalPane, etc.) observe the same state. Toggling in
 * one component instantly re-renders all others — this is what makes the xterm
 * theme effect in TerminalPane fire on every appearance change.
 *
 * The OS preference listener is registered in useEffect (rather than module-level)
 * so it can be captured by test mocks and garbage-collected when all consumers
 * unmount. Multiple consumers each register+unregister the same handler safely
 * because the handler is idempotent (it calls setShared, which notifies all subs).
 */
export function useAppearance(): {
  appearance: Appearance
  setAppearance: (a: Appearance) => void
  toggle: () => void
} {
  const appearance = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Listen for OS preference changes — only auto-applies when no manual override.
  // Registered per hook instance so tests can use vi.stubGlobal('matchMedia', …).
  // Multiple registrations are safe: each fires setShared which notifies all subs.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent) => {
      let hasOverride = false
      try {
        hasOverride = localStorage.getItem(STORAGE_KEY) !== null
      } catch {
        // ignore
      }
      if (!hasOverride) {
        setShared(e.matches ? 'dawn' : 'dusk')
      }
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function setAppearance(a: Appearance): void {
    setShared(a)
  }

  function toggle(): void {
    setShared(appearance === 'dawn' ? 'dusk' : 'dawn')
  }

  return { appearance, setAppearance, toggle }
}
