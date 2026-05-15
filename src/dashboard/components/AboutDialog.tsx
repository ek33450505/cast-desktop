/**
 * AboutDialog — floating dropdown popover anchored near top-center.
 *
 * Opened by `window.dispatchEvent(new Event('cast:open-about'))`.
 * No full-screen backdrop — it renders as a compact dropdown that appears
 * below the topbar. Click-outside, Escape, and focus-trap are all wired.
 *
 * A11y:
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap: Tab / Shift+Tab cycle within the dialog
 * - Escape closes; click-outside closes
 */

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { APP_VERSION, REPO_URL } from '../lib/version'
import { AppIconSVG } from './AppIcon'

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

  // Click-outside: close when clicking the transparent overlay
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  // Transparent click-catcher that fills the viewport; no dark backdrop.
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: 48,           // sits just below the topbar
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 3001,
    background: 'var(--system-elevated)',
    border: '1px solid var(--stroke-regular)',
    borderRadius: 12,
    padding: '20px 24px',
    width: 300,
    boxShadow: 'var(--shadow-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    outline: 'none',
    animation: shouldReduceMotion ? 'none' : 'cast-about-drop 0.12s ease',
  }

  return (
    <>
      <style>{`
        @keyframes cast-about-drop {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px) }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) }
        }
      `}</style>

      {/* Transparent overlay for click-outside */}
      <div
        style={overlayStyle}
        onClick={handleOverlayClick}
        data-testid="about-backdrop"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        style={dropdownStyle}
        data-testid="about-dialog"
      >
          {/* App icon + wordmark group */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <AppIconSVG size={56} aria-hidden="true" />
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
    </>
  )
}

