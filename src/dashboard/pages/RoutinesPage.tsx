import { useState } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import { useRoutines, useRoutineOutput } from '../api/useRoutines'
import type { RoutineRow } from '../api/useRoutines'
import { StatusBadge } from '../components/StatusBadge'
import { timeAgo } from '../utils/time'

// ── Badge variant helper ───────────────────────────────────────────────────────

function statusVariant(status: string | null): 'failed' | 'healthy' | 'warning' | null {
  if (status === 'failure') return 'failed'
  if (status === 'success') return 'healthy'
  if (status === null) return 'warning'
  return 'warning'
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function RoutineSkeleton() {
  return (
    <div role="region" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading routines">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bento-card p-5 space-y-3">
          <div className="h-4 w-32 rounded animate-pulse bg-[var(--system-elevated)]" />
          <div className="h-3 w-24 rounded animate-pulse bg-[var(--system-elevated)]" />
          <div className="h-3 w-20 rounded animate-pulse bg-[var(--system-elevated)]" />
          <div className="h-3 w-28 rounded animate-pulse bg-[var(--system-elevated)]" />
        </div>
      ))}
    </div>
  )
}

// ── Output disclosure ──────────────────────────────────────────────────────────

function RoutineOutputDisclosure({ id }: { id: string }) {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading } = useRoutineOutput(id, expanded)

  return (
    <div className="mt-3 pt-3 border-t border-[var(--stroke-subtle)]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="text-xs text-[var(--content-secondary)] hover:text-[var(--content-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1 rounded"
      >
        {expanded ? 'Hide output' : 'View output'}
      </button>

      {expanded && (
        <div
          role="region"
          aria-label="Routine output"
          className="mt-2"
        >
          {isLoading ? (
            <div className="h-16 rounded animate-pulse bg-[var(--system-elevated)]" />
          ) : data?.content ? (
            <pre className="text-xs font-mono bg-[var(--system-elevated)] rounded p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-words text-[var(--content-secondary)]">
              {data.content}
            </pre>
          ) : (
            <p className="text-xs text-[var(--content-muted)] italic">
              (no output captured)
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Routine card ──────────────────────────────────────────────────────────────

function RoutineCard({ routine }: { routine: RoutineRow }) {
  const variant = statusVariant(routine.last_run_status)

  return (
    <article
      aria-label={`Routine: ${routine.name}`}
      className="bento-card p-5 flex flex-col gap-2"
    >
      {/* Header row: name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--content-primary)] truncate">
          {routine.name}
        </h2>
        {variant !== null && (
          <StatusBadge variant={variant} size="sm" />
        )}
      </div>

      {/* Trigger */}
      <p className="text-xs text-[var(--content-secondary)]">
        <span className="text-[var(--content-muted)]">Trigger: </span>
        <span className="font-mono">
          {routine.trigger_type}
          {routine.trigger_value ? ` ${routine.trigger_value}` : ''}
        </span>
      </p>

      {/* Agent */}
      <p className="text-xs text-[var(--content-secondary)]">
        <span className="text-[var(--content-muted)]">Agent: </span>
        <span className="font-mono">{routine.agent}</span>
      </p>

      {/* Last run */}
      <p className="text-xs text-[var(--content-secondary)]">
        <span className="text-[var(--content-muted)]">Last run: </span>
        {routine.last_run_at ? timeAgo(routine.last_run_at) : 'never'}
      </p>

      {/* Output disclosure — only shown when output path is set */}
      {routine.last_run_output_path && (
        <RoutineOutputDisclosure id={routine.id} />
      )}
    </article>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const { data, isLoading, error, refetch } = useRoutines()
  const routines = data?.routines ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5 text-[var(--content-muted)]" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-[var(--content-primary)]">Routines</h1>
          <p className="text-xs text-[var(--content-muted)]">
            Scheduled Cast jobs and their last-run status
          </p>
        </div>
      </div>

      {/* States */}
      {isLoading && <RoutineSkeleton />}

      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-[var(--content-secondary)]">Could not load routines.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1 rounded"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && routines.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Clock className="w-8 h-8 text-[var(--content-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--content-secondary)]">No routines configured</p>
          <p className="text-xs text-[var(--content-muted)]">
            Define routines in your Cast configuration to see them here.
          </p>
        </div>
      )}

      {!isLoading && !error && routines.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
    </div>
  )
}
