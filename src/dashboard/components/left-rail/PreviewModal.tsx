import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import PreviewBody from './PreviewBody'
import Skeleton from '../Skeleton'

function basename(p: string): string {
  return p.split('/').at(-1) ?? p
}

// ── types ─────────────────────────────────────────────────────────────────────

interface PreviewResponse {
  path: string
  content: string
  mtime: number
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchPreview(filePath: string, source: 'cast' | 'project'): Promise<PreviewResponse> {
  const endpoint = source === 'project' ? '/api/project-fs/preview' : '/api/cast-fs/preview'
  const res = await fetch(`${endpoint}?path=${encodeURIComponent(filePath)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PreviewResponse>
}

// ── component ─────────────────────────────────────────────────────────────────

interface PreviewModalProps {
  path: string
  source?: 'cast' | 'project'
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement | null>
}

export default function PreviewModal({ path: filePath, source = 'cast', onClose, triggerRef }: PreviewModalProps) {
  const shouldReduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview-modal', filePath, source],
    queryFn: () => fetchPreview(filePath, source),
    staleTime: 60_000,
    retry: false,
  })

  const fileName = basename(filePath)

  // Focus panel on open
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  // Restore focus on close
  useEffect(() => {
    return () => {
      const el = triggerRef?.current
      if (el) {
        requestAnimationFrame(() => { el.focus() })
      }
    }
  }, [triggerRef])

  // Escape closes; Tab traps focus inside dialog
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableSelector =
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement

        if (e.shiftKey) {
          // Shift+Tab at first element → wrap to last
          if (active === first || !dialogRef.current.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          // Tab at last element → wrap to first
          if (active === last || !dialogRef.current.contains(active)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [onClose],
  )

  // Backdrop click closes
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'var(--system-vibrancy-base)',
        backdropFilter: shouldReduceMotion ? 'none' : 'var(--system-vibrancy-blur)',
        WebkitBackdropFilter: shouldReduceMotion ? 'none' : 'var(--system-vibrancy-blur)',
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex flex-col rounded-xl shadow-2xl overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1"
        style={{
          width: '80vw',
          height: '80vh',
          maxWidth: '1200px',
          background: 'var(--system-elevated)',
          border: '1px solid var(--stroke-regular)',
          boxShadow: 'var(--shadow-3)',
          animation: shouldReduceMotion ? 'none' : 'previewModalIn 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--stroke-regular)] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p id="preview-modal-title" className="text-sm font-medium text-[var(--content-primary)] truncate" title={fileName}>
              {fileName}
            </p>
            <p className="text-[11px] text-[var(--content-muted)] truncate" title={filePath}>
              {filePath}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex items-center justify-center rounded text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1 flex-shrink-0"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading && (
            <div className="p-4 space-y-2" aria-label="Loading preview">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton
                  key={i}
                  width={`${35 + i * 12}%`}
                  height="1rem"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-[var(--status-error)]" role="alert">
              Failed to load file: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}

          {data && (
            <PreviewBody filePath={filePath} content={data.content} />
          )}
        </div>
      </div>
    </div>
  )
}
