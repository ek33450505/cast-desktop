import { useState } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useHookFailures } from '../api/useHookFailures'
import type { HookFailureRow } from '../api/useHookFailures'
import { timeAgo } from '../utils/time'

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function groupByHook(failures: HookFailureRow[]): Map<string, HookFailureRow[]> {
  const map = new Map<string, HookFailureRow[]>()
  for (const f of failures) {
    if (!map.has(f.hook_name)) map.set(f.hook_name, [])
    map.get(f.hook_name)!.push(f)
  }
  return map
}

function SkeletonRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--system-elevated)', width: `${95 - i * 5}%` }} />
      ))}
    </>
  )
}

export default function HookFailuresPage() {
  const [last24h, setLast24h] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const since = last24h ? new Date(Date.now() - 86_400_000).toISOString() : undefined
  const { data, isLoading } = useHookFailures(since)
  const failures = data?.failures ?? []
  const grouped = groupByHook(failures)

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" style={{ color: 'var(--color-rose-400, #f87171)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Hook Failures</h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--content-muted)' }}>
            Failed hook invocations logged by CAST.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLast24h(prev => !prev)}
          aria-pressed={last24h}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: last24h ? 'rgb(239 68 68 / 0.15)' : 'var(--system-elevated)',
            color: last24h ? 'rgb(248 113 113)' : 'var(--content-secondary)',
            border: `1px solid ${last24h ? 'rgb(239 68 68 / 0.3)' : 'var(--border)'}`,
          }}
        >
          Last 24h only
        </button>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3 rounded-xl" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
          <SkeletonRows />
        </div>
      ) : failures.length === 0 ? (
        <div className="p-10 flex flex-col items-center gap-3 text-center rounded-xl" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
          <CheckCircle className="w-8 h-8" aria-hidden="true" style={{ color: 'rgb(52 211 153)' }} />
          <p className="text-sm" style={{ color: 'var(--content-secondary)' }}>No hook failures in the selected period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([hookName, rows]) => (
            <div key={hookName} className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
              <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="font-mono text-sm font-semibold" style={{ color: 'var(--content-primary)' }}>{hookName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--content-muted)' }}>
                    most recent: {timeAgo(rows[0].timestamp)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgb(239 68 68 / 0.15)', color: 'rgb(248 113 113)' }}>
                    {rows.length} {rows.length === 1 ? 'failure' : 'failures'}
                  </span>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-muted)' }}>Timestamp</th>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-muted)' }}>Exit Code</th>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--content-muted)' }}>Session</th>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-muted)' }}>stderr</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isExpanded = expandedRows.has(row.id)
                    const hasStderr = !!row.stderr?.trim()
                    return (
                      <>
                        <tr
                          key={row.id}
                          className={`transition-colors ${hasStderr ? 'cursor-pointer' : ''}`}
                          onClick={() => hasStderr && toggleRow(row.id)}
                          aria-expanded={hasStderr ? isExpanded : undefined}
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          <td className="px-5 py-2.5 text-xs tabular-nums whitespace-nowrap" style={{ color: 'var(--content-muted)' }}>
                            {formatDate(row.timestamp)}
                          </td>
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: 'rgb(239 68 68 / 0.15)', color: 'rgb(248 113 113)' }}>
                              {row.exit_code}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-xs font-mono hidden sm:table-cell" style={{ color: 'var(--content-muted)' }}>
                            {row.session_id ? row.session_id.slice(0, 12) + '…' : '—'}
                          </td>
                          <td className="px-5 py-2.5 text-xs" style={{ color: 'var(--content-secondary)' }}>
                            {hasStderr ? (
                              <span style={{ color: 'var(--accent)' }}>{isExpanded ? '▲ hide' : '▼ expand'}</span>
                            ) : (
                              <span style={{ color: 'var(--content-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasStderr && (
                          <tr key={`${row.id}-stderr`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--system-elevated)' }}>
                            <td colSpan={4} className="px-5 py-3">
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed" style={{ color: 'var(--content-secondary)' }}>
                                {row.stderr}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
