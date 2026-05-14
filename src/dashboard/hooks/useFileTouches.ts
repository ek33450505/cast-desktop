/**
 * useFileTouches — fetches agent touch history for a file path.
 *
 * Data source: GET /api/files/touches?path=<abs>
 * Returns [] gracefully if the file_writes table doesn't exist yet.
 */

import { useState, useEffect, useCallback } from 'react'

export interface FileTouch {
  agent_name: string
  tool_name: string | null
  ts: string
  run_id: string | null
  line_range: string | null
}

interface UseFileTouchesResult {
  touches: FileTouch[]
  loading: boolean
  error: string | null
  refresh: () => void
}

// Module-level cache: path → { touches, fetchedAt }
const cache = new Map<string, { touches: FileTouch[]; fetchedAt: number }>()
const CACHE_TTL_MS = 30_000

export function useFileTouches(filePath: string | null): UseFileTouchesResult {
  const [touches, setTouches] = useState<FileTouch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => {
    if (filePath) cache.delete(filePath)
    setRevision((r) => r + 1)
  }, [filePath])

  useEffect(() => {
    if (!filePath) {
      setTouches([])
      setLoading(false)
      setError(null)
      return
    }

    const cached = cache.get(filePath)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setTouches(cached.touches)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const encoded = encodeURIComponent(filePath)
    fetch(`/api/files/touches?path=${encoded}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<FileTouch[]>
      })
      .then((data) => {
        if (cancelled) return
        cache.set(filePath, { touches: data, fetchedAt: Date.now() })
        setTouches(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(String(err))
        setTouches([])
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [filePath, revision])

  return { touches, loading, error, refresh }
}
