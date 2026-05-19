/**
 * KeyboardShortcutOverlay — modal triggered by the `?` key.
 *
 * Lists all keyboard shortcuts in two columns:
 *  - Navigation: Cmd+K, Cmd+E, Cmd+B, Cmd+Alt+B
 *  - App: ?, Esc
 *
 * A11y:
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap: Tab / Shift+Tab cycle within the dialog
 * - Escape closes; click-outside closes
 * - Uses ModalHeader for consistent title/close pattern
 */

import { useEffect, useRef } from 'react'
import { Keyboard } from 'lucide-react'
import { ModalHeader } from './ui/ModalHeader'

// ── Props ──────────────────────────────────────────────────────────────────────

export interface KeyboardShortcutOverlayProps {
  open: boolean
  onClose: () => void
}

// ── Shortcut data ──────────────────────────────────────────────────────────────

interface ShortcutEntry {
  key: string
  description: string
}

const NAVIGATION_SHORTCUTS: ShortcutEntry[] = [
  { key: '⌘K', description: 'Open command palette' },
  { key: '⌘E', description: 'Open editor' },
  { key: '⌘B', description: 'Toggle left rail' },
  { key: '⌘⌥B', description: 'Toggle right rail' },
]

const APP_SHORTCUTS: ShortcutEntry[] = [
  { key: '?', description: 'Show shortcuts' },
  { key: 'Esc', description: 'Close / dismiss' },
]

// ── Sub-component ──────────────────────────────────────────────────────────────

function ShortcutList({ entries }: { entries: ShortcutEntry[] }) {
  return (
    <ul className="space-y-2" role="list">
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="flex items-center justify-between gap-4"
        >
          <span className="text-sm text-[var(--content-secondary)]">
            {entry.description}
          </span>
          <kbd
            className="shrink-0 px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-tertiary)] text-[var(--content-primary)] border border-[var(--stroke-regular)]"
          >
            {entry.key}
          </kbd>
        </li>
      ))}
    </ul>
  )
}

// ── KeyboardShortcutOverlay ────────────────────────────────────────────────────

export function KeyboardShortcutOverlay({ open, onClose }: KeyboardShortcutOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingId = 'keyboard-shortcuts-heading'

  // Autofocus on open
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus()
    }
  }, [open])

  // Escape closes; Tab focus trap
  useEffect(() => {
    if (!open) return

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
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-testid="shortcuts-backdrop"
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 rounded-xl overflow-hidden shadow-2xl shadow-black/40 outline-none"
        style={{
          background: 'var(--system-elevated)',
          border: '1px solid var(--stroke-regular)',
        }}
        data-testid="keyboard-shortcut-overlay"
      >
        <div id={headingId}>
          <ModalHeader
            icon={Keyboard}
            title="Keyboard Shortcuts"
            onClose={onClose}
          />
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Navigation column */}
          <section aria-labelledby="shortcuts-nav-heading">
            <h3
              id="shortcuts-nav-heading"
              className="text-xs font-semibold uppercase tracking-widest text-[var(--content-secondary)] mb-3"
            >
              Navigation
            </h3>
            <ShortcutList entries={NAVIGATION_SHORTCUTS} />
          </section>

          {/* App column */}
          <section aria-labelledby="shortcuts-app-heading">
            <h3
              id="shortcuts-app-heading"
              className="text-xs font-semibold uppercase tracking-widest text-[var(--content-secondary)] mb-3"
            >
              App
            </h3>
            <ShortcutList entries={APP_SHORTCUTS} />
          </section>
        </div>
      </div>
    </>
  )
}
