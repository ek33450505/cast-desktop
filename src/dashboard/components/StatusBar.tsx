import { GitBranch } from 'lucide-react'
import { useSystemHealth } from '../api/useSystem'
import { useCostSummary } from '../api/useCostSummary'
import { useGitBranch } from '../api/useGitBranch'

function formatCost(costUsd: number | undefined, loading: boolean): string {
  if (loading) return '—'
  if (costUsd == null) return '—'
  return `$${costUsd.toFixed(2)}`
}

export function StatusBar() {
  const { data: health, isLoading: healthLoading } = useSystemHealth()
  const { data: cost, isLoading: costLoading } = useCostSummary(30)
  const { data: gitData } = useGitBranch()

  const model = healthLoading ? '—' : (health?.model ?? '—')
  const sessionCost = formatCost(cost?.totals.costUsd, costLoading)
  const branch = gitData?.branch ?? '—'

  return (
    <div
      role="status"
      aria-live="off"
      className="shrink-0 h-8 px-4 flex items-center gap-3 text-xs"
      style={{
        background: 'var(--system-elevated)',
        borderTop: '1px solid var(--border)',
        color: 'var(--content-muted)',
      }}
    >
      {/* Git branch */}
      <span className="flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" aria-hidden="true" />
        <span>{branch}</span>
      </span>

      <span aria-hidden="true">·</span>

      {/* Model */}
      <span>{model}</span>

      <span aria-hidden="true">·</span>

      {/* Session cost (30-day rolling) */}
      <span>{sessionCost}</span>
    </div>
  )
}
