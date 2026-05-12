import { useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Bot,
  Wrench,
  BookOpen,
  Brain,
  ClipboardList,
  Terminal,
  Plug,
  FolderOpen,
} from 'lucide-react'

interface Section {
  id: string
  label: string
  Icon: React.ElementType
}

const SECTIONS: Section[] = [
  { id: 'agents',   label: 'Agents',   Icon: Bot },
  { id: 'skills',   label: 'Skills',   Icon: Wrench },
  { id: 'rules',    label: 'Rules',    Icon: BookOpen },
  { id: 'memory',   label: 'Memory',   Icon: Brain },
  { id: 'plans',    label: 'Plans',    Icon: ClipboardList },
  { id: 'commands', label: 'Commands', Icon: Terminal },
  { id: 'mcp',      label: 'MCP',      Icon: Plug },
  { id: 'projects', label: 'Projects', Icon: FolderOpen },
]

interface LeftRailProps {
  open: boolean
  onExpand: () => void
}

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)] mb-2 select-none">
        {label}
      </p>
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-6 rounded-md bg-[var(--bg-tertiary)] animate-pulse"
            style={{ width: `${60 + i * 10}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}

export default function LeftRail({ open, onExpand }: LeftRailProps) {
  const shouldReduceMotion = useReducedMotion()
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  function handleIconClick(id: string) {
    if (!open) {
      onExpand()
      // Scroll after expand animation
      setTimeout(
        () => {
          sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        shouldReduceMotion ? 0 : 250,
      )
    } else {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: 'easeInOut' as const }

  return (
    <nav
      aria-label="Left rail navigation"
      className="h-full flex flex-col overflow-hidden"
      style={{
        background: 'var(--cast-rail-bg)',
        borderRight: '1px solid var(--cast-rail-border)',
      }}
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
            <div className="py-2 space-y-4">
              {SECTIONS.map(({ id, label }) => (
                <div
                  key={id}
                  ref={(el) => { sectionRefs.current[id] = el }}
                >
                  <SectionSkeleton label={label} />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="flex-1 flex flex-col items-center gap-1 py-2 overflow-y-auto"
          >
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleIconClick(id)}
                aria-label={`Navigate to ${label} section`}
                className="flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-1"
                style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
