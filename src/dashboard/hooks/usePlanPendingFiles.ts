/**
 * usePlanPendingFiles — returns a Set of file paths referenced by active
 * (non-done) plans in cast.db.
 *
 * Data source: GET /api/files/plan-pending-files
 * Polls every 30 seconds.
 */

import { useState, useEffect } from 'react'

const POLL_INTERVAL_MS = 30_000

export function usePlanPendingFiles(): Set<string> {
  const [pendingFiles, setPendingFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function fetchPendingFiles() {
      try {
        const res = await fetch('/api/files/plan-pending-files')
        if (!res.ok) return
        const paths = (await res.json()) as string[]
        if (!cancelled) {
          setPendingFiles(new Set(paths))
        }
      } catch {
        // Graceful: leave existing set unchanged on network error
      }
    }

    fetchPendingFiles()
    const timer = setInterval(fetchPendingFiles, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return pendingFiles
}
