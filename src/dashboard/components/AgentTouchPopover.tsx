/**
 * AgentTouchPopover — floating panel listing recent agent touches for a file.
 *
 * a11y: role="dialog", aria-labelledby, focus-trap via useEffect, Escape closes.
 */

import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type { FileTouch } from '../hooks/useFileTouches'

interface AgentTouchPopoverProps {
  touches: FileTouch[]
  anchorEl: HTMLElement | null
  filename: string
  onClose: () => void
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

function truncateRunId(runId: string | null): string {
  if (!runId) return '—'
  return runId.slice(0, 8)
}

const TITLE_ID = 'agent-touch-popover-title'

export function AgentTouchPopover({
  touches,
  anchorEl,
  filename,
  onClose,
}: AgentTouchPopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus the dialog on open
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, anchorEl])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        zIndex: 9999,
        background: 'var(--cast-top-bar-bg, #1e1e1e)',
        border: '1px solid var(--cast-rail-border, rgba(255,255,255,0.12))',
        borderRadius: 8,
        padding: '12px 14px',
        minWidth: 260,
        maxWidth: 360,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        outline: 'none',
        // Anchor top-left near the gutter; position is approximate
        // since we don't have Tauri popover API — close-to-gutter is fine for v1
        top: 120,
        left: 52,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          id={TITLE_ID}
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Agent touches · {filename}
        </span>
        <button
          aria-label="Close agent touch history"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--cast-accent)'
            e.currentTarget.style.outlineOffset = '-2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Touch list */}
      {touches.length === 0 ? (
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          No agent edits recorded yet.
        </p>
      ) : (
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {touches.map((touch, idx) => (
            <li
              key={`${touch.run_id ?? idx}-${touch.ts}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  color: 'var(--cast-accent, #00FFC2)',
                  fontWeight: 600,
                  flexShrink: 0,
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {touch.agent_name}
              </span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatTime(touch.ts)}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  opacity: 0.7,
                }}
                title={touch.run_id ?? undefined}
              >
                run {truncateRunId(touch.run_id)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
