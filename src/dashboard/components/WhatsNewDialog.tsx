/**
 * WhatsNewDialog — top-drop popover showing the latest release notes.
 *
 * Opened by `window.dispatchEvent(new Event('cast:open-whats-new'))`.
 * Renders CHANGELOG.md (imported at build time via ?raw) through the same
 * markdown pipeline as PreviewBody.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import changelogText from '../../../CHANGELOG.md?raw'

export interface WhatsNewDialogProps {
  onClose: () => void
}

export function WhatsNewDialog({ onClose }: WhatsNewDialogProps) {
  const shouldReduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingId = 'whats-new-dialog-heading'

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Show only the most recent two version sections so the popover stays
  // focused on what's actually new. Users can read the full changelog on
  // GitHub via the link at the bottom.
  const latestSections = useMemo(() => {
    const lines = changelogText.split('\n')
    const versionLineIdxs: number[] = []
    lines.forEach((line, i) => {
      if (line.startsWith('## [')) versionLineIdxs.push(i)
    })
    if (versionLineIdxs.length === 0) return changelogText
    const start = versionLineIdxs[0]
    const end = versionLineIdxs[2] ?? lines.length // first two sections
    return lines.slice(start, end).join('\n')
  }, [])

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: 48,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 3001,
    background: 'var(--system-elevated)',
    border: '1px solid var(--stroke-regular)',
    borderRadius: 12,
    padding: '18px 22px',
    width: 520,
    maxWidth: '90vw',
    maxHeight: '70vh',
    boxShadow: 'var(--shadow-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    outline: 'none',
    animation: shouldReduceMotion ? 'none' : 'cast-whats-new-drop 0.12s ease',
  }

  return (
    <>
      <style>{`
        @keyframes cast-whats-new-drop {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px) }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) }
        }
        .cast-whats-new-body { overflow-y: auto; font-size: 0.8125rem; line-height: 1.5; color: var(--content-secondary); }
        .cast-whats-new-body h1 { font-size: 1rem; font-weight: 600; color: var(--content-primary); margin: 0 0 8px; }
        .cast-whats-new-body h2 { font-size: 0.9375rem; font-weight: 600; color: var(--content-primary); margin: 14px 0 6px; }
        .cast-whats-new-body h3 { font-size: 0.8125rem; font-weight: 600; color: var(--content-primary); margin: 12px 0 4px; }
        .cast-whats-new-body p { margin: 6px 0; }
        .cast-whats-new-body ul { margin: 4px 0 8px; padding-left: 18px; }
        .cast-whats-new-body li { margin: 2px 0; }
        .cast-whats-new-body code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.75rem; background: var(--system-pane); padding: 1px 4px; border-radius: 3px; }
        .cast-whats-new-body a { color: var(--cast-accent, #E6A532); text-decoration: none; }
        .cast-whats-new-body a:hover { text-decoration: underline; }
      `}</style>

      <div
        style={overlayStyle}
        onClick={handleOverlayClick}
        data-testid="whats-new-backdrop"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        style={dropdownStyle}
        data-testid="whats-new-dialog"
      >
        <h2
          id={headingId}
          style={{
            margin: 0,
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--content-primary)',
          }}
        >
          What's New
        </h2>

        <div className="cast-whats-new-body">
          <ReactMarkdown>{latestSections}</ReactMarkdown>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            aria-label="Close what's new dialog"
            onClick={onClose}
            style={{
              padding: '6px 18px',
              fontSize: '0.8125rem',
              borderRadius: 6,
              cursor: 'pointer',
              outline: 'none',
              fontWeight: 500,
              border: '1px solid var(--stroke-regular)',
              background: 'transparent',
              color: 'var(--content-muted)',
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
