import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ClipboardList, Bot, BarChart2 } from 'lucide-react'
import PlanProgressPanel from './right-rail/PlanProgressPanel'
import LiveAgentsPanel from './right-rail/LiveAgentsPanel'
import CostPanel from './right-rail/CostPanel'
import AnalyticsTiles from './right-rail/AnalyticsTiles'

interface RightPanel {
  id: string
  label: string
  Icon: React.ElementType
}

const PANELS: RightPanel[] = [
  { id: 'plan-progress',    label: 'Plan Progress',    Icon: ClipboardList },
  { id: 'live-agents',      label: 'Live Agents',      Icon: Bot },
  { id: 'cost-analytics',   label: 'Cost & Analytics', Icon: BarChart2 },
]

function EmptyCard({ label, Icon }: { label: string; Icon: React.ElementType }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-center"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--cast-rail-border)',
        minHeight: '80px',
      }}
    >
      <Icon className="w-5 h-5 text-[var(--text-muted)]" aria-hidden="true" />
      <span className="text-xs text-[var(--text-muted)] select-none">{label}</span>
    </div>
  )
}

interface RightRailProps {
  open: boolean
  onExpand: () => void
}

export default function RightRail({ open, onExpand }: RightRailProps) {
  const shouldReduceMotion = useReducedMotion()

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: 'easeInOut' as const }

  return (
    <aside
      aria-label="Right rail panels"
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--system-panel)' }}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={transition}
            className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3"
          >
            {PANELS.map(({ id, label, Icon }) => (
              <section key={id} aria-labelledby={`right-panel-${id}`}>
                <h2
                  id={`right-panel-${id}`}
                  className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)] mb-1.5 px-1 select-none"
                >
                  {label}
                </h2>
                {id === 'plan-progress' ? (
                  <PlanProgressPanel />
                ) : id === 'live-agents' ? (
                  <LiveAgentsPanel />
                ) : id === 'cost-analytics' ? (
                  <div className="space-y-3">
                    <CostPanel />
                    <AnalyticsTiles />
                  </div>
                ) : (
                  <EmptyCard label={label} Icon={Icon} />
                )}
              </section>
            ))}
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
            {PANELS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={onExpand}
                aria-label={`Expand right rail to see ${label}`}
                className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}
