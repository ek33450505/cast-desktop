import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import NavList from './NavList'

interface LeftRailProps {
  open: boolean
  onExpand: () => void
}

export default function LeftRail({ open, onExpand }: LeftRailProps) {
  const shouldReduceMotion = useReducedMotion()

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: 'easeInOut' as const }

  return (
    <nav
      aria-label="Left rail navigation"
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--system-panel)' }}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={transition}
            className="flex-1 overflow-y-auto overflow-x-hidden"
          >
            <NavList />
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-y-auto"
          >
            {/* Collapsed: icon-only strip — clicking any icon expands the rail */}
            <button
              type="button"
              onClick={onExpand}
              aria-label="Expand navigation rail (⌘B)"
              title="Expand navigation rail (⌘B)"
              className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
              style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Three horizontal lines (hamburger / nav icon) */}
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
