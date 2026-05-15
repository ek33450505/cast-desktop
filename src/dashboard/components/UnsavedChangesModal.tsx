/**
 * UnsavedChangesModal — Prompts "Save / Discard / Cancel" when the user
 * attempts to close a dirty tab or navigate away from the editor.
 *
 * A11y:
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap: Tab / Shift+Tab cycle within the modal
 * - Escape = Cancel
 * - "Save" is the default-focused button (safer default)
 */

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

interface UnsavedChangesModalProps {
  dirtyPaths: string[]
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

export function UnsavedChangesModal({
  dirtyPaths,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  const shouldReduceMotion = useReducedMotion()
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus "Save" button on mount (safer default)
  useEffect(() => {
    saveButtonRef.current?.focus()
  }, [])

  // Escape = Cancel; focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
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
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  const fileList = dirtyPaths.map(basename).join(', ')
  const headingId = 'unsaved-changes-heading'

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    animation: shouldReduceMotion ? 'none' : 'cast-fade-in 0.1s ease',
  }

  const dialogStyle: React.CSSProperties = {
    background: 'var(--cast-center-bg)',
    border: '1px solid var(--cast-rail-border)',
    borderRadius: 10,
    padding: '24px 28px',
    minWidth: 340,
    maxWidth: 460,
    width: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    animation: shouldReduceMotion ? 'none' : 'cast-slide-up 0.1s ease',
  }

  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  }

  const bodyStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  }

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    borderTop: '1px solid var(--cast-rail-border)',
    paddingTop: 16,
  }

  const baseButtonStyle: React.CSSProperties = {
    padding: '7px 16px',
    fontSize: '0.8125rem',
    borderRadius: 6,
    cursor: 'pointer',
    outline: 'none',
    fontWeight: 500,
  }

  return (
    <>
      <style>{`
        @keyframes cast-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cast-slide-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={backdropStyle} onClick={handleBackdropClick}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          style={dialogStyle}
        >
          <h2 id={headingId} style={headingStyle}>
            Unsaved Changes
          </h2>

          <p style={bodyStyle}>
            {dirtyPaths.length === 1
              ? `"${fileList}" has unsaved changes.`
              : `${dirtyPaths.length} files have unsaved changes: ${fileList}.`}{' '}
            Do you want to save before closing?
          </p>

          <div style={actionsStyle}>
            <button
              aria-label="Cancel — keep editor open"
              style={{
                ...baseButtonStyle,
                border: '1px solid var(--cast-rail-border)',
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
              onClick={onCancel}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Cancel
            </button>

            <button
              aria-label="Discard changes — close without saving"
              style={{
                ...baseButtonStyle,
                border: '1px solid var(--cast-rail-border)',
                background: 'transparent',
                color: 'var(--text-primary)',
              }}
              onClick={onDiscard}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Don't Save
            </button>

            <button
              ref={saveButtonRef}
              aria-label="Save changes and close"
              style={{
                ...baseButtonStyle,
                border: 'none',
                background: 'var(--cast-accent)',
                color: 'var(--bg-primary)',
                fontWeight: 600,
              }}
              onClick={onSave}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--text-primary)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
