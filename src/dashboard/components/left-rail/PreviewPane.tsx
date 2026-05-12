import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft, Maximize2 } from 'lucide-react'
import PreviewBody from './PreviewBody'

function basename(filePath: string): string {
  return filePath.split('/').at(-1) ?? filePath
}

// ── types ─────────────────────────────────────────────────────────────────────

interface PreviewResponse {
  path: string
  content: string
  mtime: number
}

// ── threshold ─────────────────────────────────────────────────────────────────

const LARGE_FILE_BYTES = 5 * 1024  // 5 KB
const LARGE_FILE_LINES = 100

export function isLargeContent(content: string): boolean {
  if (new Blob([content]).size > LARGE_FILE_BYTES) return true
  if (content.split('\n').length > LARGE_FILE_LINES) return true
  return false
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchPreview(filePath: string, source: 'cast' | 'project' = 'cast'): Promise<PreviewResponse> {
  const endpoint = source === 'project' ? '/api/project-fs/preview' : '/api/cast-fs/preview'
  const res = await fetch(`${endpoint}?path=${encodeURIComponent(filePath)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PreviewResponse>
}

// ── component ─────────────────────────────────────────────────────────────────

interface PreviewPaneProps {
  path: string
  source?: 'cast' | 'project'
  onClose: () => void
  onExpand?: () => void
}

export default function PreviewPane({ path: filePath, source = 'cast', onClose, onExpand }: PreviewPaneProps) {
  const shouldReduceMotion = useReducedMotion()

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview', filePath, source],
    queryFn: () => fetchPreview(filePath, source),
    staleTime: 60_000,
    retry: false,
  })

  // Auto-promote large files to modal after fetch
  useEffect(() => {
    if (data && onExpand && isLargeContent(data.content)) {
      onExpand()
    }
  }, [data, onExpand])

  // Escape key closes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const fileName = basename(filePath)

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        willChange: shouldReduceMotion ? 'auto' : 'transform, opacity',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--cast-rail-border)] flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to file tree"
          className="flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-1 flex-shrink-0"
          style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] truncate" title={filePath}>
            {filePath}
          </p>
        </div>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label="Open in full view"
            className="flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-1 flex-shrink-0"
            style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading && (
          <div className="p-3 space-y-2" aria-label="Loading preview">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-4 rounded bg-[var(--bg-tertiary)] animate-pulse"
                style={{ width: `${40 + i * 15}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-[var(--error)]" role="alert">
            Failed to load file: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {data && (
          <PreviewBody filePath={filePath} content={data.content} />
        )}
      </div>
    </div>
  )
}
