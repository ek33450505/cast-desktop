import { Shield, CheckCircle2, XCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useQualityGateStats } from '../../api/useCastData'
import { useChartColors } from '../../hooks/useChartColors'
import Skeleton from '../Skeleton'

export default function QualityGatesPanel() {
  const { data, isLoading } = useQualityGateStats()
  const colors = useChartColors()

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
        <Skeleton width="10rem" height="1.5rem" className="mb-4" />
        <Skeleton height="12rem" />
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Shield className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--content-primary)]">Quality Gates</h2>
        </div>
        <p className="text-sm text-[var(--content-muted)] py-8 text-center">No quality gate data yet</p>
      </div>
    )
  }

  const agentData = Object.entries(data.by_agent)
    .map(([name, stats]) => ({
      agent: name,
      total: stats.total,
      passed: stats.passed,
      failed: stats.total - stats.passed,
      rate: stats.rate,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Shield className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--content-primary)]">Quality Gates</h2>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--system-elevated)] rounded-lg p-3 text-center">
          {/* Total checks: neutral measurement */}
          <div className="text-2xl font-bold text-[var(--content-primary)] tabular-nums">{data.total}</div>
          <div className="text-xs text-[var(--content-muted)]">Total Checks</div>
        </div>
        <div className="bg-[var(--system-elevated)] rounded-lg p-3 text-center">
          {/* Pass rate: genuine status-success signal */}
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" style={{ color: colors.success }} />
            <span className="text-2xl font-bold tabular-nums" style={{ color: colors.success }}>{data.pass_rate}%</span>
          </div>
          <div className="text-xs text-[var(--content-muted)]">Pass Rate</div>
        </div>
        <div className="bg-[var(--system-elevated)] rounded-lg p-3 text-center">
          {/* Blocked count: genuine status-error signal */}
          <div className="flex items-center justify-center gap-1.5">
            <XCircle className="w-4 h-4" style={{ color: colors.error }} />
            <span className="text-2xl font-bold tabular-nums" style={{ color: colors.error }}>
              {data.total - Math.round((data.total * data.pass_rate) / 100)}
            </span>
          </div>
          <div className="text-xs text-[var(--content-muted)]">Blocked</div>
        </div>
      </div>

      {/* Per-agent bar chart */}
      {agentData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider mb-3">Per-Agent Compliance</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, agentData.length * 28)}>
            <BarChart data={agentData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
              <XAxis type="number" tick={{ fill: colors.axisTick, fontSize: 11 }} axisLine={{ stroke: colors.gridStroke }} />
              <YAxis
                type="category"
                dataKey="agent"
                width={110}
                tick={{ fill: colors.tooltipText, fontSize: 10, fontFamily: 'Geist Mono, monospace' }}
                axisLine={{ stroke: colors.gridStroke }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              {/* Passed/failed stacked bars: genuine status signals */}
              <Bar dataKey="passed" name="Passed" stackId="a" fill={colors.success} radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" name="Failed" stackId="a" fill={colors.error} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
