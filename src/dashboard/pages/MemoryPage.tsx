import { useState, useRef } from 'react'
import { Brain } from 'lucide-react'
import { useProjectMemory } from '../api/useMemory'
import type { MemoryFile } from '../../types/index'
import PreviewModal from '../components/left-rail/PreviewModal'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
  } catch {
    return iso
  }
}

type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

function typeBadgeStyle(type: string | undefined): React.CSSProperties {
  switch (type as MemoryType) {
    case 'user':
      return { background: 'rgba(14,165,233,0.12)', color: 'rgb(38,162,210)', border: '1px solid rgba(14,165,233,0.25)' }
    case 'feedback':
      return { background: 'rgba(245,158,11,0.12)', color: 'rgb(217,131,17)', border: '1px solid rgba(245,158,11,0.25)' }
    case 'project':
      return { background: 'rgba(16,185,129,0.12)', color: 'rgb(22,163,92)', border: '1px solid rgba(16,185,129,0.25)' }
    case 'reference':
      return { background: 'rgba(139,92,246,0.12)', color: 'rgb(124,78,220)', border: '1px solid rgba(139,92,246,0.25)' }
    default:
      return { background: 'var(--system-elevated)', color: 'var(--content-muted)', border: '1px solid var(--border)' }
  }
}

function SkeletonRows() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 animate-pulse flex items-start gap-3"
          style={{ borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}
          aria-hidden="true"
        >
          <div className="h-5 w-16 rounded" style={{ background: 'var(--system-elevated)' }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 rounded" style={{ background: 'var(--system-elevated)', width: `${55 + i * 7}%` }} />
            <div className="h-3 rounded" style={{ background: 'var(--system-elevated)', width: `${35 + i * 5}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

interface MemoryRowProps {
  mem: MemoryFile
  onClick: (mem: MemoryFile, ref: React.RefObject<HTMLButtonElement | null>) => void
}

function MemoryRow({ mem, onClick }: MemoryRowProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const label = mem.name || mem.filename || mem.path.split('/').at(-1) || ''

  return (
    <button
      ref={btnRef}
      type="button"
      className="w-full text-left px-4 py-3 transition-colors hover:bg-[var(--system-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]"
      style={{ minHeight: '44px' }}
      onClick={() => onClick(mem, btnRef)}
    >
      <div className="flex items-start gap-3">
        {mem.type && (
          <span
            className="shrink-0 text-xs px-2 py-0.5 rounded font-medium mt-0.5"
            style={typeBadgeStyle(mem.type)}
          >
            {mem.type}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--content-primary)' }}>
              {label}
            </p>
            <span className="shrink-0 text-xs" style={{ color: 'var(--content-muted)' }}>
              {formatDate(mem.modifiedAt)}
            </span>
          </div>
          {mem.description && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--content-muted)' }}>
              {mem.description}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

export default function MemoryPage() {
  const { data: memories = [], isLoading, error } = useProjectMemory()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  function handleRowClick(mem: MemoryFile, ref: React.RefObject<HTMLButtonElement | null>) {
    triggerRef.current = ref.current
    setSelectedPath(mem.path)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Brain className="w-5 h-5" aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Memory</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--content-muted)' }}>Project memory files</p>
        </div>
      </div>

      {isLoading && <SkeletonRows />}

      {error && (
        <div className="rounded-xl p-4 text-sm" role="alert" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)', color: 'var(--content-muted)' }}>
          Failed to load memory files.
        </div>
      )}

      {!isLoading && !error && memories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Brain className="w-10 h-10 opacity-20" aria-hidden="true" style={{ color: 'var(--content-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--content-muted)' }}>No memory files found</p>
        </div>
      )}

      {!isLoading && !error && memories.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
          {memories.map((mem, i) => (
            <div key={mem.path} style={{ borderBottom: i < memories.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <MemoryRow mem={mem} onClick={handleRowClick} />
            </div>
          ))}
        </div>
      )}

      {selectedPath && (
        <PreviewModal
          path={selectedPath}
          source="cast"
          onClose={() => setSelectedPath(null)}
          triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
        />
      )}
    </div>
  )
}
