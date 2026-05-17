import React, { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { useIncidents } from '../api/useIncidents'
import type { IncidentRow } from '../api/useIncidents'
import { formatShortDateTime } from '../utils/time'

function ResolutionBadge({ status }: { status: string | null }) {
  const val = (status ?? '').toLowerCase()
  const style = val === 'fixed'
    ? { background: 'rgb(52 211 153 / 0.2)', color: 'rgb(52 211 153)' }
    : { background: 'rgb(239 68 68 / 0.2)', color: 'rgb(248 113 113)' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={style}>
      {val === 'fixed' ? 'fixed' : 'open'}
    </span>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--system-elevated)', width: `${95 - i * 5}%` }} />
      ))}
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return (
    <div className="flex gap-3 text-xs">
      <span className="w-28 shrink-0" style={{ color: 'var(--content-muted)' }}>{label}</span>
      <span style={{ color: 'var(--content-muted)', opacity: 0.5 }}>—</span>
    </div>
  )
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-28 shrink-0" style={{ color: 'var(--content-muted)' }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ color: 'var(--content-secondary)' }}>
        {mono ? value.slice(0, 7) : value}
      </span>
    </div>
  )
}

function countByStatus(incidents: IncidentRow[]): { fixed: number; open: number } {
  let fixed = 0; let open = 0
  for (const inc of incidents) {
    if ((inc.resolution_status ?? '').toLowerCase() === 'fixed') fixed++
    else open++
  }
  return { fixed, open }
}

export default function IncidentsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data, isLoading } = useIncidents()
  const incidents = data?.incidents ?? []
  const { fixed, open } = countByStatus(incidents)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5" aria-hidden="true" style={{ color: 'rgb(248 113 113)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Incidents</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--content-muted)' }}>
          Manually recorded system incidents and root cause log
        </p>
      </div>

      {!isLoading && (
        <div className="flex items-center gap-6">
          {[
            { val: incidents.length, label: 'total', color: 'var(--content-primary)' },
            { val: fixed, label: 'fixed', color: 'rgb(52 211 153)' },
            { val: open, label: 'open', color: 'rgb(248 113 113)' },
          ].map(({ val, label, color }) => (
            <div key={label} className="px-4 py-3 flex items-center gap-2 rounded-xl" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
              <span className="text-2xl font-bold" style={{ color }}>{val}</span>
              <span className="text-xs" style={{ color: 'var(--content-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
        {isLoading ? (
          <SkeletonRows />
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: 'var(--content-muted)' }}>
            <AlertCircle className="w-10 h-10 mb-3 opacity-20" aria-hidden="true" />
            <div className="font-medium">No incidents recorded</div>
            <div className="text-xs mt-1 opacity-60">The incidents table is empty</div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead style={{ background: 'var(--system-elevated)' }}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="w-6 px-3 py-2" />
                <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--content-muted)' }}>Date</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--content-muted)' }}>Problem</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--content-muted)' }}>Status</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--content-muted)' }}>Surfaced By</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <React.Fragment key={inc.id}>
                  <tr
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => setExpandedId(prev => prev === inc.id ? null : inc.id)}
                  >
                    <td className="px-3 py-2" style={{ color: 'var(--content-muted)' }}>
                      {expandedId === inc.id
                        ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--content-muted)' }}>{formatShortDateTime(inc.occurred_at)}</td>
                    <td className="px-3 py-2 max-w-sm" style={{ color: 'var(--content-secondary)' }}>{inc.problem_summary}</td>
                    <td className="px-3 py-2"><ResolutionBadge status={inc.resolution_status} /></td>
                    <td className="px-3 py-2" style={{ color: 'var(--content-muted)' }}>{inc.surfaced_by ?? '—'}</td>
                  </tr>
                  {expandedId === inc.id && (
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--system-elevated)' }}>
                      <td />
                      <td colSpan={4} className="px-4 py-4">
                        <div className="space-y-2">
                          <DetailRow label="Fix summary" value={inc.fix_summary} />
                          <DetailRow label="Related files" value={inc.related_files} />
                          <DetailRow label="Related commit" value={inc.related_commit} mono />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
