import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RowDetailModalProps {
  table: string
  row: Record<string, unknown>
  onClose: () => void
}

// ── Focusable element query ────────────────────────────────────────────────────
// Copied verbatim from AgentDetailModal.tsx

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// ── Value rendering ────────────────────────────────────────────────────────────

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    // Guard against circular refs (TypeError from JSON.stringify)
    return String(value)
  }
}

function renderValue(value: unknown): React.ReactNode {
  // null / undefined
  if (value === null || value === undefined) {
    return (
      <span style={{ color: 'var(--content-muted)' }}>{'<null>'}</span>
    )
  }

  // Already structured (object / array)
  if (typeof value === 'object') {
    return (
      <pre
        className="text-xs whitespace-pre-wrap break-words m-0"
        style={{ color: 'var(--content-primary)', fontFamily: 'inherit' }}
      >
        {safeStringify(value)}
      </pre>
    )
  }

  // String — attempt JSON parse
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      // Only pretty-print if it round-trips as a non-primitive
      if (typeof parsed === 'object' && parsed !== null) {
        return (
          <pre
            className="text-xs whitespace-pre-wrap break-words m-0"
            style={{ color: 'var(--content-primary)', fontFamily: 'inherit' }}
          >
            {safeStringify(parsed)}
          </pre>
        )
      }
    } catch {
      // Not valid JSON — fall through to string rendering
    }
    // Plain string — preserve newlines
    return (
      <span
        className="text-xs whitespace-pre-wrap break-words"
        style={{ color: 'var(--content-primary)' }}
      >
        {value}
      </span>
    )
  }

  // number, boolean, bigint, symbol, function
  return (
    <span className="text-xs" style={{ color: 'var(--content-primary)' }}>
      {String(value)}
    </span>
  )
}

// ── RowDetailModal ─────────────────────────────────────────────────────────────

export default function RowDetailModal({ table, row, onClose }: RowDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const titleId = `row-detail-title-${table}`

  // Save trigger element on mount; restore focus on unmount.
  // Pattern copied from AgentDetailModal — capture once so rapid opens don't
  // overwrite the original trigger before close restores focus to it.
  useEffect(() => {
    if (!triggerRef.current) {
      triggerRef.current = document.activeElement
    }
    requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      el?.focus()
    })

    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
      triggerRef.current = null
    }
  }, [])

  // Trap focus inside modal + Escape dismiss
  // Pattern copied from AgentDetailModal.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  const entries = Object.entries(row)

  return (
    /* Backdrop — click outside the dialog to close */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--overlay-backdrop)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-hidden="false"
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex flex-col rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden"
        style={{
          background: 'var(--system-panel)',
          border: '1px solid var(--border)',
        }}
        onKeyDown={handleKeyDown}
        // Stop propagation so clicks inside the modal do NOT bubble to the backdrop
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 gap-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2
            id={titleId}
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--content-primary)' }}
          >
            Row detail — {table}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close row detail"
            className="ml-auto shrink-0 rounded-md flex items-center justify-center motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
            style={{
              width: '44px',
              height: '44px',
              color: 'var(--content-muted)',
              background: 'transparent',
            }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body — key-value grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {entries.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--content-muted)' }}>
              No columns to display.
            </p>
          ) : (
            <dl className="flex flex-col gap-3">
              {entries.map(([col, val]) => (
                <div key={col}>
                  <dt
                    className="text-[10px] uppercase tracking-wider font-medium mb-0.5"
                    style={{ color: 'var(--content-muted)' }}
                  >
                    {col}
                  </dt>
                  <dd className="m-0">{renderValue(val)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
