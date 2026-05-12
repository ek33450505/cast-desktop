import { useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Bot,
  Wrench,
  BookOpen,
  Brain,
  ClipboardList,
  Terminal,
  Plug,
  Webhook,
  FolderOpen,
} from 'lucide-react'
import CastFsTree from './left-rail/CastFsTree'
import PreviewPane, { isLargeContent } from './left-rail/PreviewPane'
import PreviewModal from './left-rail/PreviewModal'
import type { PreviewTarget, SectionId } from './left-rail/CastFsTree'

interface Section {
  id: SectionId | 'project'
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
  { id: 'hooks',    label: 'Hooks',    Icon: Webhook },
  { id: 'project',  label: 'Project',  Icon: FolderOpen },
]

type PreviewMode = 'inline' | 'modal' | null

interface SelectedPreview {
  path: string
  source: 'cast' | 'project'
  content?: string
}

interface LeftRailProps {
  open: boolean
  onExpand: () => void
}

export default function LeftRail({ open, onExpand }: LeftRailProps) {
  const shouldReduceMotion = useReducedMotion()
  const [previewMode, setPreviewMode] = useState<PreviewMode>(null)
  const [selected, setSelected] = useState<SelectedPreview | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  function handlePreview(target: PreviewTarget, triggerEl?: HTMLElement) {
    triggerRef.current = triggerEl ?? null
    setSelected({ path: target.path, source: target.source ?? 'cast' })
    // Start in inline mode; after fetch in PreviewPane large-file detection
    // will call onExpand to promote to modal if needed
    setPreviewMode('inline')
  }

  function handleAutoPromote() {
    setPreviewMode('modal')
  }

  function handleCloseInline() {
    setPreviewMode(null)
    setSelected(null)
    const el = triggerRef.current
    if (el) {
      requestAnimationFrame(() => { el.focus() })
    }
    triggerRef.current = null
  }

  function handleCloseModal() {
    // Return to inline if we promoted from inline; otherwise close entirely
    setPreviewMode(null)
    setSelected(null)
    const el = triggerRef.current
    if (el) {
      requestAnimationFrame(() => { el.focus() })
    }
    triggerRef.current = null
  }

  function handleIconClick(id: string) {
    if (!open) {
      onExpand()
    }
    void id
  }

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: 'easeInOut' as const }

  const slideTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: 'easeInOut' as const }

  return (
    <>
      <nav
        aria-label="Left rail navigation"
        className="h-full flex flex-col overflow-hidden"
        style={{ background: 'var(--cast-rail-bg)' }}
      >
        <AnimatePresence initial={false} mode="wait">
          {open ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={transition}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <AnimatePresence initial={false} mode="wait">
                {previewMode === 'inline' && selected ? (
                  <motion.div
                    key="preview"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                    transition={slideTransition}
                    className="flex-1 overflow-hidden flex flex-col"
                  >
                    <PreviewPane
                      path={selected.path}
                      source={selected.source}
                      onClose={handleCloseInline}
                      onExpand={handleAutoPromote}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="tree"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                    transition={slideTransition}
                    className="flex-1 overflow-y-auto overflow-x-hidden"
                  >
                    <div className="py-1">
                      <CastFsTree onPreview={handlePreview} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

      {/* Modal overlay — rendered outside nav so it's not clipped */}
      {previewMode === 'modal' && selected && (
        <PreviewModal
          path={selected.path}
          source={selected.source}
          onClose={handleCloseModal}
          triggerRef={triggerRef}
        />
      )}
    </>
  )
}

// Re-export for downstream consumers that import from LeftRail
export { isLargeContent }
