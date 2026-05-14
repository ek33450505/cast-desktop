import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEvent } from '../../../lib/SseManager'
import type { LiveEvent } from '../../../types'
import { ClipboardList } from 'lucide-react'
import { usePaneBinding } from '../../../hooks/usePaneBinding'
import { useTerminalStore } from '../../../stores/terminalStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanTask {
  id: string
  text: string
  done: boolean
}

interface ActivePlanData {
  planPath: string | null
  title: string | null
  tasks: PlanTask[]
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchActivePlan(sessionId: string | null): Promise<ActivePlanData> {
  if (!sessionId) return { planPath: null, title: null, tasks: [] }
  const res = await fetch(`/api/plans/active?sessionId=${encodeURIComponent(sessionId)}`)
  if (!res.ok) throw new Error(`Failed to fetch active plan: HTTP ${res.status}`)
  return res.json() as Promise<ActivePlanData>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center py-6 px-3"
      aria-label="No active plan"
    >
      <ClipboardList
        className="w-6 h-6"
        style={{ color: 'var(--content-muted)' }}
        aria-hidden="true"
      />
      <p className="text-xs" style={{ color: 'var(--content-muted)' }}>
        No active plan
      </p>
      <code
        className="text-xs rounded px-1.5 py-0.5 font-mono"
        style={{
          background: 'var(--system-elevated)',
          color: 'var(--content-secondary)',
          border: '1px solid var(--stroke-regular)',
        }}
      >
        /plan
      </code>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2 p-2" aria-label="Loading plan">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-4 rounded animate-pulse"
          style={{ background: 'var(--system-elevated)', opacity: 0.6 }}
        />
      ))}
    </div>
  )
}

// ── PlanProgressPanel ─────────────────────────────────────────────────────────

export default function PlanProgressPanel() {
  const queryClient = useQueryClient()

  // Get active pane's sessionId from terminal store + pane binding
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activePaneId = activeTab?.paneId ?? undefined

  const { sessionId } = usePaneBinding(activePaneId)

  // Fetch active plan
  const { data, isLoading } = useQuery<ActivePlanData>({
    queryKey: ['active-plan', sessionId],
    queryFn: () => fetchActivePlan(sessionId),
    staleTime: 30_000,
  })

  // Subscribe to SSE for live plan updates
  useEvent<LiveEvent>('plan_progress_updated', () => {
    void queryClient.invalidateQueries({ queryKey: ['active-plan', sessionId] })
  })

  if (isLoading) {
    return <LoadingState />
  }

  const hasTasks = data?.tasks && data.tasks.length > 0

  if (!data?.planPath || !hasTasks) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Plan file header */}
      <p
        className="text-xs font-mono truncate px-1"
        style={{ color: 'var(--content-muted)' }}
        title={data.planPath}
      >
        {data.title}
      </p>

      {/* Task list */}
      <ul
        role="list"
        aria-live="polite"
        aria-label="Plan tasks"
        className="flex flex-col gap-1"
      >
        {data.tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2 text-xs px-1">
            <input
              type="checkbox"
              checked={task.done}
              disabled
              aria-label={task.text}
              className="mt-0.5 shrink-0 cursor-default"
              style={{ accentColor: 'var(--accent)' }}
              readOnly
            />
            <span
              className={task.done ? 'line-through opacity-60' : ''}
              style={{ color: task.done ? 'var(--content-muted)' : 'var(--content-secondary)' }}
            >
              {task.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
