import { useMemo } from 'react'
import { Brain } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useDbMemories } from '../../api/useCastData'
import { useChartColors } from '../../hooks/useChartColors'

// Memory type colors — categorical, not status. Maps to semantic tokens via the hook.
// TODO: migrate to --chart-N tokens when a chart-token wave adds them.
// procedural → success (green), project → haiku/info (blue), feedback → warning (amber),
// reference → opus/neutral, agent-memory → error (rose)
function getTypeColor(type: string, colors: { success: string; haiku: string; warning: string; opus: string; error: string; axisTick: string }): string {
  switch (type) {
    case 'procedural': return colors.success
    case 'project': return colors.haiku
    case 'feedback': return colors.warning
    case 'reference': return colors.opus
    case 'agent-memory': return colors.error
    default: return colors.axisTick
  }
}

export default function MemoryAnalyticsPanel() {
  const { data: memories, isLoading } = useDbMemories()
  const colors = useChartColors()

  const tooltipStyle = {
    background: 'var(--system-elevated)',
    border: '1px solid var(--stroke-regular)',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--content-primary)',
  }

  const { byType, topRetrieved, avgImportance } = useMemo(() => {
    if (!memories || memories.length === 0) {
      return { byType: [], topRetrieved: [], avgImportance: 0 }
    }

    const typeCounts: Record<string, number> = {}
    let importanceSum = 0
    let importanceCount = 0

    for (const m of memories) {
      const t = m.type ?? 'unknown'
      typeCounts[t] = (typeCounts[t] ?? 0) + 1
      if (m.importance != null) {
        importanceSum += m.importance
        importanceCount++
      }
    }

    const byType = Object.entries(typeCounts).map(([name, value]) => ({
      name,
      value,
      color: getTypeColor(name, colors),
    }))

    const topRetrieved = [...memories]
      .filter(m => m.importance != null && m.importance > 0)
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, 10)

    const avgImportance = importanceCount > 0
      ? Math.round((importanceSum / importanceCount) * 100) / 100
      : 0

    return { byType, topRetrieved, avgImportance }
  }, [memories, colors])

  if (isLoading) {
    return (
      <div className="bento-card p-6">
        <div className="h-6 w-40 bg-[var(--system-elevated)] rounded animate-pulse mb-4" />
        <div className="h-48 bg-[var(--system-elevated)] rounded animate-pulse" />
      </div>
    )
  }

  if (!memories || memories.length === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Brain className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--content-primary)]">Memory Analytics</h2>
        </div>
        <p className="text-sm text-[var(--content-muted)] py-8 text-center">No memory data in cast.db</p>
      </div>
    )
  }

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Brain className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--content-primary)]">Memory Analytics</h2>
        <span className="text-xs text-[var(--content-muted)] ml-auto tabular-nums">{memories.length} memories</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Type distribution pie chart */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider mb-3">By Type</h3>
          {byType.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name">
                    {byType.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-1">
                {byType.map(entry => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-[var(--content-secondary)]">{entry.name}</span>
                    <span className="text-[var(--content-muted)] tabular-nums">({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Avg importance — supporting metric, neutral */}
          <div className="mt-4 bg-[var(--system-elevated)] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-[var(--accent)] tabular-nums">{avgImportance}</div>
            <div className="text-xs text-[var(--content-muted)]">Avg Importance Score</div>
          </div>
        </div>

        {/* Top retrieved memories */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider mb-3">Top by Importance</h3>
          {topRetrieved.length === 0 ? (
            <p className="text-xs text-[var(--content-muted)] py-4 text-center">No importance data</p>
          ) : (
            <div className="space-y-1.5">
              {topRetrieved.map(m => (
                <div key={m.id} className="flex items-center gap-2 text-xs bg-[var(--system-elevated)] rounded px-3 py-2">
                  <span className="font-mono text-[var(--content-primary)] truncate flex-1">{m.name}</span>
                  <span className="text-[var(--content-muted)] shrink-0">{m.agent}</span>
                  {/* Importance score is the hero value for each row */}
                  <span className="text-[var(--accent)] font-bold tabular-nums shrink-0">{m.importance?.toFixed(2) ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

