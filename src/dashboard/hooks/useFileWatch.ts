/**
 * useFileWatch — watches an array of file paths for external changes via
 * Tauri's @tauri-apps/plugin-fs watch API.
 *
 * On change event for a watched path, calls the registered onChange callback
 * for that path. Debounces identical events within 100ms.
 *
 * Degrades gracefully in browser dev mode (no Tauri): silently no-ops.
 */

import { useEffect, useRef } from 'react'

export type FileChangeCallback = (path: string) => void

interface UseFileWatchOptions {
  /** Paths to watch */
  paths: string[]
  /** Called when an external change is detected for a path */
  onChange: FileChangeCallback
  /** Debounce window in ms — default 100 */
  debounceMs?: number
}

export function useFileWatch({ paths, onChange, debounceMs = 100 }: UseFileWatchOptions): void {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Debounce timers per path
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (paths.length === 0) return

    let unwatchFns: Array<() => void> = []
    let cancelled = false

    async function setupWatchers() {
      try {
        const { watch } = await import('@tauri-apps/plugin-fs')

        for (const watchPath of paths) {
          if (cancelled) break
          try {
            // Tauri watch returns an unwatch function
            const unwatch = await watch(
              watchPath,
              (_event) => {
                if (cancelled) return

                // Debounce per path
                const existing = debounceTimers.current.get(watchPath)
                if (existing) clearTimeout(existing)

                const timer = setTimeout(() => {
                  debounceTimers.current.delete(watchPath)
                  onChangeRef.current(watchPath)
                }, debounceMs)

                debounceTimers.current.set(watchPath, timer)
              },
            )
            unwatchFns.push(unwatch)
          } catch (err) {
            // Individual file watch failure — log and continue watching others
            console.warn('[useFileWatch] failed to watch', watchPath, err)
          }
        }
      } catch {
        // Tauri plugin not available (browser dev mode) — silently no-op
      }
    }

    setupWatchers()

    return () => {
      cancelled = true
      // Clear all debounce timers
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer)
      }
      debounceTimers.current.clear()
      // Unwatch all paths
      for (const unwatch of unwatchFns) {
        try {
          unwatch()
        } catch {
          // Ignore unwatch errors on cleanup
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|'), debounceMs])
}
