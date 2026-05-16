import { useState } from 'react'
import { ShieldAlert, RefreshCw, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  useAgentHallucinationsSummary,
  useAgentHallucinations,
} from '../api/useAgentHallucinations'
import type { HallucinationRow, HallucinationFilters } from '../api/useAgentHallucinations'
import { useAgentHallucinationDetail } from '../api/useAgentHallucinationDetail'
import { timeAgo } from '../utils/time'
import { useChartColors } from '../hooks/useChartColors'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str: string | null | undefined, len: number): string {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading agent reliability data" className="flex flex-col gap-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bento-card p-5 space-y-2">
            <div className="h-3 w-20 rounded animate-pulse bg-[var(--system-elevated)]" />
            <div className="h-6 w-12 rounded animate-pulse bg-[var(--system-elevated)]" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="bento-card p-5">
        <div className="h-[320px] rounded animate-pulse bg-[var(--system-elevated)]" />
      </div>
      {/* Table skeleton */}
      <div className="bento-card p-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-full rounded animate-pulse bg-[var(--system-elevated)]" />
        ))}
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bento-card p-5 flex flex-col gap-1">
      <p className="text-xs text-[var(--content-muted)]">{label}</p>
      <p className="text-2xl font-semibold text-[var(--content-primary)]">{value}</p>
    </div>
  )
}

// ── Verified icon ─────────────────────────────────────────────────────────────

function VerifiedIcon({ verified }: { verified: number }) {
  if (verified === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
        <Check className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Verified</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-400 text-xs">
      <X className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Unverified</span>
    </span>
  )
}

// ── Expand row ────────────────────────────────────────────────────────────────

interface ExpandRowProps {
  row: HallucinationRow
  colSpan: number
}

function ExpandRow({ row, colSpan }: ExpandRowProps) {
  // Fetch the full (un-truncated) detail row on demand
  const detail = useAgentHallucinationDetail(row.id, true)
  const full = detail.data ?? row

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-3 bg-[var(--system-elevated)]">
        <div role="region" aria-label={`Detail for hallucination claim ${row.id}`} className="flex flex-col gap-2 text-xs font-mono">
          <div>
            <span className="text-[var(--content-muted)]">Claimed value: </span>
            <span className="text-[var(--content-primary)] break-all">{full.claimed_value ?? '—'}</span>
          </div>
          <div>
            <span className="text-[var(--content-muted)]">Actual value: </span>
            <span className="text-[var(--content-primary)] break-all">{full.actual_value ?? '—'}</span>
          </div>
          <div>
            <span className="text-[var(--content-muted)]">Session ID: </span>
            <span className="text-[var(--content-primary)]">{full.session_id ?? '—'}</span>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Claims table row ──────────────────────────────────────────────────────────

interface ClaimRowProps {
  row: HallucinationRow
  expanded: boolean
  onToggle: () => void
}

function ClaimRow({ row, expanded, onToggle }: ClaimRowProps) {
  return (
    <tr className="border-b border-[var(--stroke-subtle)] hover:bg-[var(--system-elevated)] transition-colors">
      <td className="px-4 py-2 text-xs">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`Expand details for claim ${row.id}`}
          onClick={onToggle}
          className="flex items-center gap-1 text-[var(--content-secondary)] hover:text-[var(--content-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1 rounded"
        >
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          }
          <span className="font-mono">{row.agent_name}</span>
        </button>
      </td>
      <td className="px-4 py-2 text-xs text-[var(--content-secondary)] font-mono">{row.claim_type}</td>
      <td className="px-4 py-2 text-xs text-[var(--content-secondary)] font-mono max-w-[200px]">
        <span title={row.claimed_value ?? undefined} aria-label={row.claimed_value ?? 'none'}>{truncate(row.claimed_value, 40)}</span>
      </td>
      <td className="px-4 py-2 text-xs"><VerifiedIcon verified={row.verified} /></td>
      <td className="px-4 py-2 text-xs text-[var(--content-muted)]">{timeAgo(row.timestamp)}</td>
      <td className="px-4 py-2 text-xs text-[var(--content-muted)] font-mono">
        {row.session_id ? row.session_id.slice(0, 8) : '—'}
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentReliabilityPage() {
  const colors = useChartColors()

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<HallucinationFilters>({
    limit: PAGE_SIZE,
    offset: 0,
  })
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const summary = useAgentHallucinationsSummary()
  const list = useAgentHallucinations(filters)

  const isLoading = summary.isLoading || list.isLoading
  const hasError = summary.error || list.error

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalClaims = summary.data?.total ?? 0
  const unverifiedCount = summary.data?.byAgent.reduce((acc, r) => acc + r.unverified, 0) ?? 0
  const mostAffected = summary.data?.byAgent[0]?.agent_name ?? '—'

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = summary.data?.byAgent ?? []

  // ── Filter handlers ────────────────────────────────────────────────────────
  const agentOptions = summary.data?.byAgent.map((r) => r.agent_name) ?? []

  function clearFilters() {
    setFilters({ limit: PAGE_SIZE, offset: 0 })
    setExpandedRows(new Set())
  }

  function setAgent(agent: string) {
    setFilters((prev) => ({ ...prev, agent: agent || undefined, offset: 0 }))
  }

  function setVerified(v: '' | '0' | '1') {
    setFilters((prev) => ({ ...prev, verified: v === '' ? null : v, offset: 0 }))
  }

  function setDateFrom(date: string) {
    setFilters((prev) => ({ ...prev, date_from: date || undefined, offset: 0 }))
  }

  function setDateTo(date: string) {
    setFilters((prev) => ({ ...prev, date_to: date || undefined, offset: 0 }))
  }

  function toggleRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const total = list.data?.total ?? 0
  const offset = filters.offset ?? 0
  const page = Math.floor(offset / PAGE_SIZE)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  function prevPage() {
    setFilters((prev) => ({ ...prev, offset: Math.max(0, (prev.offset ?? 0) - PAGE_SIZE) }))
  }

  function nextPage() {
    setFilters((prev) => ({ ...prev, offset: (prev.offset ?? 0) + PAGE_SIZE }))
  }

  const hallucinations = list.data?.hallucinations ?? []

  // ── Render: loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-[var(--content-muted)]" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--content-primary)]">Agent Reliability</h1>
            <p className="text-xs text-[var(--content-muted)]">
              Tracks agent claims (e.g., "I wrote file X") against filesystem reality. Each row is a claim that didn't match.
            </p>
          </div>
        </div>
        <PageSkeleton />
      </div>
    )
  }

  // ── Render: error ──────────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-[var(--content-muted)]" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-[var(--content-primary)]">Agent Reliability</h1>
        </div>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-[var(--content-secondary)]">Could not load hallucinations.</p>
          <button
            type="button"
            onClick={() => { summary.refetch(); list.refetch() }}
            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1 rounded"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-[var(--content-muted)]" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-[var(--content-primary)]">Agent Reliability</h1>
          <p className="text-xs text-[var(--content-muted)]">
            Tracks agent claims (e.g., "I wrote file X") against filesystem reality. Each row is a claim that didn't match.
          </p>
        </div>
      </div>

      {/* ── Summary stats ───────────────────────────────────────────── */}
      {totalClaims === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <ShieldAlert className="w-8 h-8 text-[var(--content-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--content-secondary)]">No agent hallucinations recorded.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total claims" value={totalClaims.toLocaleString()} />
            <StatCard label="Unverified" value={unverifiedCount.toLocaleString()} />
            <StatCard label="Most affected agent" value={mostAffected} />
          </div>

          {/* ── Per-agent bar chart ──────────────────────────────────── */}
          <div className="bento-card p-5">
            <h2 className="text-sm font-semibold text-[var(--content-primary)] mb-4">
              Claims per agent
            </h2>
            <div
              aria-label="Hallucination count per agent, stacked by verified status"
              role="img"
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 24, bottom: 40, left: 0 }}
                >
                  <XAxis
                    dataKey="agent_name"
                    tick={{ fill: 'var(--content-secondary)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: colors.axisTick, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: colors.tooltipText,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'var(--content-secondary)' }}
                  />
                  <Bar dataKey="verified" name="Verified" stackId="a" fill={colors.axisTick} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unverified" name="Unverified" stackId="a" fill={colors.error} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Filters ──────────────────────────────────────────────── */}
          <div className="bento-card p-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Agent dropdown */}
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label htmlFor="reliability-agent-filter" className="text-xs text-[var(--content-muted)]">
                  Agent
                </label>
                <select
                  id="reliability-agent-filter"
                  value={filters.agent ?? ''}
                  onChange={(e) => setAgent(e.target.value)}
                  className="text-xs rounded bg-[var(--system-elevated)] border border-[var(--stroke-regular)] text-[var(--content-primary)] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                >
                  <option value="">All agents</option>
                  {agentOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Claim type — pill (future-ready) */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--content-muted)]">Claim type</span>
                <div className="flex gap-1.5">
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--system-elevated)] text-[var(--content-secondary)] border border-[var(--stroke-regular)]"
                    aria-label="Claim type: file_write (only type available)"
                  >
                    file_write
                  </span>
                </div>
              </div>

              {/* Date from */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reliability-date-from" className="text-xs text-[var(--content-muted)]">
                  From
                </label>
                <input
                  id="reliability-date-from"
                  type="date"
                  value={filters.date_from ?? ''}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs rounded bg-[var(--system-elevated)] border border-[var(--stroke-regular)] text-[var(--content-primary)] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                />
              </div>

              {/* Date to */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reliability-date-to" className="text-xs text-[var(--content-muted)]">
                  To
                </label>
                <input
                  id="reliability-date-to"
                  type="date"
                  value={filters.date_to ?? ''}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs rounded bg-[var(--system-elevated)] border border-[var(--stroke-regular)] text-[var(--content-primary)] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                />
              </div>

              {/* Verified filter */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reliability-verified-filter" className="text-xs text-[var(--content-muted)]">
                  Verified
                </label>
                <select
                  id="reliability-verified-filter"
                  value={filters.verified ?? ''}
                  onChange={(e) => setVerified(e.target.value as '' | '0' | '1')}
                  className="text-xs rounded bg-[var(--system-elevated)] border border-[var(--stroke-regular)] text-[var(--content-primary)] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                >
                  <option value="">All</option>
                  <option value="0">Unverified</option>
                  <option value="1">Verified</option>
                </select>
              </div>

              {/* Clear filters */}
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Clear all filters"
                className="text-xs text-[var(--content-secondary)] hover:text-[var(--content-primary)] px-3 py-1.5 rounded border border-[var(--stroke-regular)] bg-[var(--system-elevated)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
              >
                Clear
              </button>
            </div>
          </div>

          {/* ── Claims table ─────────────────────────────────────────── */}
          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Agent hallucination claims</caption>
                <thead>
                  <tr className="border-b border-[var(--stroke-subtle)]">
                    <th className="px-4 py-2 text-xs font-medium text-[var(--content-muted)]">Agent</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--content-muted)]">Claim type</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--content-muted)]">Claimed value</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--content-muted)]">Verified</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--content-muted)]">Timestamp</th>
                    <th className="px-4 py-2 text-xs font-medium text-[var(--content-muted)]">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {hallucinations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--content-muted)]">
                        No hallucinations match the current filters.
                      </td>
                    </tr>
                  ) : (
                    hallucinations.flatMap((row) => {
                      const expanded = expandedRows.has(row.id)
                      return [
                        <ClaimRow
                          key={`row-${row.id}`}
                          row={row}
                          expanded={expanded}
                          onToggle={() => toggleRow(row.id)}
                        />,
                        ...(expanded ? [<ExpandRow key={`expand-${row.id}`} row={row} colSpan={6} />] : []),
                      ]
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--stroke-subtle)]">
                <p className="text-xs text-[var(--content-muted)]">
                  Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={!hasPrev}
                    onClick={prevPage}
                    className="text-xs px-3 py-1.5 rounded border border-[var(--stroke-regular)] bg-[var(--system-elevated)] text-[var(--content-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:text-[var(--content-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[var(--content-muted)] self-center">
                    {page + 1} / {Math.max(1, totalPages)}
                  </span>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={!hasNext}
                    onClick={nextPage}
                    className="text-xs px-3 py-1.5 rounded border border-[var(--stroke-regular)] bg-[var(--system-elevated)] text-[var(--content-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:text-[var(--content-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
