/**
 * AboutDialog — Phase B brand stub.
 *
 * Opened by listening for `window.dispatchEvent(new Event('cast:open-about'))`.
 * Phase C's native menu bar "Cast → About" will fire this event.
 * There is intentionally no UI surface to open it yet.
 *
 * A11y:
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap: Tab / Shift+Tab cycle within the dialog
 * - Escape closes
 *
 * Pattern-matched from DispatchModal.tsx.
 */

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { APP_VERSION, REPO_URL } from '../lib/version'

// ── WordmarkSVG (dusk variant, inline) ────────────────────────────────────────
// Inlined so the dialog has no runtime asset dependency at the stub stage.

function WordmarkSVG() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 72"
      role="img"
      aria-label="cast"
      style={{ width: 110, height: 36 }}
    >
      <g
        fontFamily="'JetBrains Mono', 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight={500}
      >
        <text
          x="0"
          y="48"
          fontSize="40"
          fill="var(--text-primary)"
          letterSpacing="-0.5"
        >
          cast
        </text>
        <circle cx="94" cy="16" r="5" fill="var(--cast-accent, #E6A532)" />
      </g>
    </svg>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface AboutDialogProps {
  onClose: () => void
}

// ── AboutDialog ────────────────────────────────────────────────────────────────

export function AboutDialog({ onClose }: AboutDialogProps) {
  const shouldReduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingId = 'about-dialog-heading'

  // Autofocus the dialog on open
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Escape closes; Tab focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // ── Styles — pattern-matched from DispatchModal ────────────────────────────

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
    padding: '28px 32px',
    minWidth: 320,
    maxWidth: 420,
    width: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    outline: 'none',
    animation: shouldReduceMotion ? 'none' : 'cast-slide-up 0.1s ease',
  }

  return (
    <>
      <style>{`
        @keyframes cast-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cast-slide-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div
        style={backdropStyle}
        onClick={handleBackdropClick}
        data-testid="about-backdrop"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          tabIndex={-1}
          style={dialogStyle}
          data-testid="about-dialog"
        >
          {/* Wordmark */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
            <WordmarkSVG />
          </div>

          {/* Version */}
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              textAlign: 'center',
            }}
          >
            Cast Desktop
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Version {APP_VERSION}
          </p>

          {/* Tagline */}
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            Your agents, in the room.
          </p>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--cast-rail-border)' }} />

          {/* Links + meta */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            <span>MIT License · macOS</span>
            <a
              href={REPO_URL}
              onClick={(e) => {
                // Tauri webview swallows target="_blank"; route through the
                // shell plugin to open in the system default browser.
                e.preventDefault()
                openExternal(REPO_URL).catch(() => { /* noop */ })
              }}
              aria-label="Open Cast Desktop on GitHub (opens in default browser)"
              style={{
                color: 'var(--cast-accent, #E6A532)',
                textDecoration: 'none',
                outline: 'none',
                cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent, #E6A532)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              GitHub
            </a>
          </div>

          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              aria-label="Close about dialog"
              onClick={onClose}
              style={{
                padding: '7px 24px',
                fontSize: '0.8125rem',
                borderRadius: 6,
                cursor: 'pointer',
                outline: 'none',
                fontWeight: 500,
                border: '1px solid var(--cast-rail-border)',
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent, #E6A532)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
