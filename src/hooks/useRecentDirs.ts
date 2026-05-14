import { useState, useCallback } from 'react'

export const RECENT_DIRS_KEY = 'cast-recent-dirs'
export const MAX_RECENT = 10

/**
 * Load recent directories from localStorage.
 * Returns [] on missing key, invalid JSON, or any thrown error.
 */
export function loadRecentDirs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/**
 * Prepend dir to list, deduplicate (remove any prior occurrence),
 * and clamp to MAX_RECENT. Does not mutate the input array.
 */
export function pushRecentDir(list: string[], dir: string): string[] {
  const filtered = list.filter((d) => d !== dir)
  return [dir, ...filtered].slice(0, MAX_RECENT)
}

/**
 * Persist recent directories to localStorage. Swallows throws
 * (e.g. private mode, storage quota exceeded).
 */
export function saveRecentDirs(dirs: string[]): void {
  try {
    localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(dirs))
  } catch {
    // swallow — private mode or quota exceeded
  }
}

/**
 * useRecentDirs — manages the LRU recent-directories list.
 *
 * State is initialized from localStorage via loadRecentDirs().
 * addRecentDir runs pushRecentDir, persists via saveRecentDirs,
 * and triggers a React state update.
 */
export function useRecentDirs(): {
  recentDirs: string[]
  addRecentDir: (dir: string) => void
} {
  const [recentDirs, setRecentDirs] = useState<string[]>(() => loadRecentDirs())

  const addRecentDir = useCallback((dir: string) => {
    setRecentDirs((prev) => {
      const next = pushRecentDir(prev, dir)
      saveRecentDirs(next)
      return next
    })
  }, [])

  return { recentDirs, addRecentDir }
}
