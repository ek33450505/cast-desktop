import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Home,
  History,
  BarChart2,
  Users,
  Layers,
  ScrollText,
  Settings,
  FileText,
  Search,
  X,
} from 'lucide-react'
import type { ComponentType } from 'react'

interface NavItem {
  label: string
  path: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Terminal', path: '/', icon: Home },
  { label: 'Sessions', path: '/sessions', icon: History },
  { label: 'Analytics', path: '/analytics', icon: BarChart2 },
  { label: 'Agents', path: '/agents', icon: Users },
  { label: 'Swarm', path: '/swarm', icon: Layers },
  { label: 'Work Log', path: '/work-log', icon: ScrollText },
  { label: 'System', path: '/system', icon: Settings },
  { label: 'Docs', path: '/docs', icon: FileText },
]

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Capture focus target before opening
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  // Restore focus on close
  const handleClose = useCallback(() => {
    onClose()
    requestAnimationFrame(() => {
      previouslyFocusedRef.current?.focus()
    })
  }, [onClose])

  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape key closes palette; Tab traps focus inside dialog
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handleClose()
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
    [handleClose],
  )

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path)
      handleClose()
    },
    [navigate, handleClose],
  )

  const backdropVariants = shouldReduceMotion
    ? {}
    : { hidden: { opacity: 0 }, visible: { opacity: 1 } }

  const cardVariants = shouldReduceMotion
    ? {}
    : {
        hidden: { opacity: 0, scale: 0.96 },
        visible: { opacity: 1, scale: 1 },
      }

  const transition = shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' as const }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            role="presentation"
            data-testid="palette-backdrop"
            className="absolute inset-0 bg-black/70"
            onClick={handleClose}
            initial={backdropVariants.hidden ?? { opacity: 0 }}
            animate={backdropVariants.visible ?? { opacity: 1 }}
            exit={backdropVariants.hidden ?? { opacity: 0 }}
            transition={transition}
          />

          {/* Palette card */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-[640px] mx-4 rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
            initial={cardVariants.hidden ?? { opacity: 0, scale: 0.96 }}
            animate={cardVariants.visible ?? { opacity: 1, scale: 1 }}
            exit={cardVariants.hidden ?? { opacity: 0, scale: 0.96 }}
            transition={transition}
            onKeyDown={handleKeyDown}
          >
            <Command
              label="Command palette"
              className="flex flex-col"
            >
              {/* Search input */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <Search className="w-4 h-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <Command.Input
                  autoFocus
                  aria-label="Search commands"
                  placeholder="Search pages…"
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close command palette"
                  className="flex items-center justify-center rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-1"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Results */}
              <Command.List
                className="overflow-y-auto"
                style={{ maxHeight: '50vh' }}
              >
                <Command.Empty>
                  <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                    No pages match your search
                  </div>
                </Command.Empty>

                <Command.Group>
                  <div
                    className="px-4 py-2"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                      Navigate
                    </span>
                  </div>

                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon
                    return (
                      <Command.Item
                        key={item.path}
                        value={`${item.label} ${item.path}`}
                        onSelect={() => handleSelect(item.path)}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-default select-none text-[var(--text-secondary)] transition-colors data-[selected=true]:bg-[var(--accent-subtle)] data-[selected=true]:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      >
                        <Icon className="w-4 h-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-[var(--text-muted)] shrink-0">{item.path}</span>
                        <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">Go →</span>
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div
                className="px-4 py-2.5 flex items-center gap-4 text-xs text-[var(--text-muted)]"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span>
                  <kbd
                    className="px-1.5 py-0.5 rounded font-mono text-[10px]"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    ↑↓
                  </kbd>{' '}
                  navigate
                </span>
                <span>
                  <kbd
                    className="px-1.5 py-0.5 rounded font-mono text-[10px]"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    ↵
                  </kbd>{' '}
                  open
                </span>
                <span>
                  <kbd
                    className="px-1.5 py-0.5 rounded font-mono text-[10px]"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    esc
                  </kbd>{' '}
                  close
                </span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
