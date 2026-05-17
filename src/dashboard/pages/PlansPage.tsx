import { useState, useRef } from 'react'
import { FileText } from 'lucide-react'
import { usePlans } from '../api/usePlans'
import type { PlanFile } from '../../types/index'
import PreviewModal from '../components/left-rail/PreviewModal'
import { formatShortDate } from '../utils/time'

function SkeletonRows() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 animate-pulse space-y-1.5"
          style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}
          aria-hidden="true"
        >
          <div className="h-4 rounded" style={{ background: 'var(--system-elevated)', width: `${60 + i * 8}%` }} />
          <div className="h-3 rounded" style={{ background: 'var(--system-elevated)', width: `${40 + i * 5}%` }} />
        </div>
      ))}
    </div>
  )
}

interface PlanRowProps {
  plan: PlanFile
  onClick: (plan: PlanFile, ref: React.RefObject<HTMLButtonElement | null>) => void
}

function PlanRow({ plan, onClick }: PlanRowProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <button
      ref={btnRef}
      type="button"
      className="w-full text-left px-4 py-3 transition-colors hover:bg-[var(--system-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]"
      style={{ minHeight: '44px' }}
      onClick={() => onClick(plan, btnRef)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--content-primary)' }}>
            {plan.title || plan.filename}
          </p>
          {plan.preview && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--content-muted)' }}>
              {plan.preview}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs" style={{ color: 'var(--content-muted)' }}>
          {formatShortDate(plan.modifiedAt)}
        </span>
      </div>
    </button>
  )
}

export default function PlansPage() {
  const { data: plans = [], isLoading, error } = usePlans()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const sorted = [...plans].sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
  )

  function handleRowClick(plan: PlanFile, ref: React.RefObject<HTMLButtonElement | null>) {
    triggerRef.current = ref.current
    setSelectedPath(plan.path)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <FileText className="w-5 h-5" aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Plans</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--content-muted)' }}>~/.claude/plans/</p>
        </div>
      </div>

      {isLoading && <SkeletonRows />}

      {error && (
        <div className="rounded-xl p-4 text-sm" role="alert" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)', color: 'var(--content-muted)' }}>
          Failed to load plans.
        </div>
      )}

      {!isLoading && !error && plans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText className="w-10 h-10 opacity-20" aria-hidden="true" style={{ color: 'var(--content-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--content-muted)' }}>No plans found</p>
        </div>
      )}

      {!isLoading && !error && sorted.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
          {sorted.map((plan, i) => (
            <div key={plan.path} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <PlanRow plan={plan} onClick={handleRowClick} />
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
