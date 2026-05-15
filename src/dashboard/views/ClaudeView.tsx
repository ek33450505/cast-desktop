import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FolderOpen } from 'lucide-react'
import ProjectFsTree from '../components/left-rail/ProjectFsTree'
import PreviewModal from '../components/left-rail/PreviewModal'
import type { PreviewTarget } from '../components/left-rail/CastFsTree'

// ── ClaudeView ─────────────────────────────────────────────────────────────────
// Surfaces ~/.claude/ as a full-page recursive filesystem tree (real directories,
// not curated sections) by reusing ProjectFsTree pointed at /api/cast-fs/tree.
// Clicking a file opens the same PreviewModal used by the left rail.

export default function ClaudeView() {
  const shouldReduceMotion = useReducedMotion()
  const [selected, setSelected] = useState<{ path: string; source: 'cast' | 'project' } | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  function handlePreview(target: PreviewTarget, triggerEl?: HTMLElement) {
    triggerRef.current = triggerEl ?? null
    setSelected({ path: target.path, source: target.source ?? 'cast' })
  }

  function handleClosePreview() {
    setSelected(null)
    const el = triggerRef.current
    if (el) {
      requestAnimationFrame(() => { el.focus() })
    }
    triggerRef.current = null
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--system-canvas)' }}
    >
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-none flex items-center gap-2 px-4 py-3 border-b border-[var(--stroke-regular)]"
        style={{ background: 'var(--system-panel)' }}
      >
        <FolderOpen className="w-4 h-4 text-[var(--accent)] shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-[var(--content-secondary)] font-mono select-none">
          ~/.claude/
        </span>
      </div>

      {/* ── Tree ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-1">
        <ProjectFsTree
          onPreview={handlePreview}
          apiBase="/api/cast-fs/tree"
          eventChannel="cast_fs_change"
        />
      </div>

      {/* ── Preview modal ────────────────────────────────────────────────────── */}
      {selected && (
        <PreviewModal
          path={selected.path}
          source={selected.source}
          onClose={handleClosePreview}
          triggerRef={triggerRef}
        />
      )}
    </motion.div>
  )
}
