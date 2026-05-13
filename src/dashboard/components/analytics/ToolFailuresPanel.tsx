import { AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useToolFailures, useToolFailureStats } from '../../api/useCastData'
import { useChartColors } from '../../hooks/useChartColors'

export default function ToolFailuresPanel() {
  const { data: stats, isLoading: statsLoading } = useToolFailureStats()
  const { data: failuresData, isLoading: failuresLoading } = useToolFailures({ limit: 20 })
  const colors = useChartColors()
  const isLoading = statsLoading || failuresLoading

  const tooltipStyle = {
    background: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: 6,
    fontSize: 11,
    color: colors.tooltipText,
  }

  if (isLoading) {
    return (
      <div className="bento-card p-6">
        <div className="h-6 w-40 bg-[var(--system-elevated)] rounded animate-pulse mb-4" />
        <div className="h-48 bg-[var(--system-elevated)] rounded animate-pulse" />
      </div>
    )
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
          <h2 className="text-base font-semibold text-[var(--content-primary)]">Tool Failures</h2>
        </div>
        <p className="text-sm text-[var(--content-muted)] py-8 text-center">No tool failures recorded</p>
      </div>
    )
  }

  const topTools = Object.entries(stats.byTool)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const failures = failuresData?.failures ?? []

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
        <h2 className="text-base font-semibold text-[var(--content-primary)]">Tool Failures</h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--system-elevated)] rounded-lg p-3 text-center">
          {/* Total failures: neutral — just a count */}
          <div className="text-2xl font-bold text-[var(--content-primary)] tabular-nums">{stats.total}</div>
          <div className="text-xs text-[var(--content-muted)]">Total Failures</div>
        </div>
        <div className="bg-[var(--system-elevated)] rounded-lg p-3 text-center">
          {/* Last 24h: warning color — recency gives it signal weight */}
          <div className="text-2xl font-bold tabular-nums" style={{ color: colors.warning }}>{stats.last24h}</div>
          <div className="text-xs text-[var(--content-muted)]">Last 24h</div>
        </div>
      </div>

      {/* Top failing tools */}
      {topTools.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider mb-3">Top Failing Tools</h3>
          <ResponsiveContainer width="100%" height={Math.max(150, topTools.length * 26)}>
            <BarChart data={topTools} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
              <XAxis type="number" tick={{ fill: colors.axisTick, fontSize: 11 }} axisLine={{ stroke: colors.gridStroke }} />
              <YAxis
                type="category"
                dataKey="tool"
                width={100}
                tick={{ fill: colors.tooltipText, fontSize: 10, fontFamily: 'Geist Mono, monospace' }}
                axisLine={{ stroke: colors.gridStroke }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              {/* Failures chart: warning color — these bars represent genuine problem signal */}
              <Bar dataKey="count" name="Failures" fill={colors.warning} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent failures table */}
      {failures.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider mb-3">Recent Failures</h3>
          <div className="space-y-1">
            {failures.slice(0, 8).map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-[var(--system-elevated)] rounded px-3 py-2">
                <span className="text-[var(--content-muted)] shrink-0 w-20 truncate">
                  {f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : '--'}
                </span>
                <span className="font-mono text-[var(--content-primary)] shrink-0 w-24 truncate">{f.tool ?? 'unknown'}</span>
                {/* Error message: status-error — this is a genuine error state */}
                <span className="truncate flex-1" style={{ color: colors.error }}>{f.error ?? 'Unknown error'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
