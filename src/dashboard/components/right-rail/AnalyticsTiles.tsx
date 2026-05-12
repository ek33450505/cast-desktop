import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { usePaneBinding } from '../../../hooks/usePaneBinding'
import { useTerminalStore } from '../../../stores/terminalStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenBucket {
  minute: string
  tokens: number
}

interface SessionAnalyticsData {
  tokenRateBuckets: TokenBucket[]
  agentFanOut: number
  qualityPass: number
  qualityFail: number
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchSessionAnalytics(sessionId: string | null): Promise<SessionAnalyticsData> {
  if (!sessionId) {
    return { tokenRateBuckets: [], agentFanOut: 0, qualityPass: 0, qualityFail: 0 }
  }
  const res = await fetch(`/api/analytics/session?sessionId=${encodeURIComponent(sessionId)}`)
  if (!res.ok) throw new Error(`Failed to fetch session analytics: HTTP ${res.status}`)
  return res.json() as Promise<SessionAnalyticsData>
}

// ── AnalyticsTiles ────────────────────────────────────────────────────────────

export default function AnalyticsTiles() {
  const shouldReduceMotion = useReducedMotion()

  // Store-read pattern: activeTabId → tab.paneId → usePaneBinding → sessionId
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activePaneId = activeTab?.paneId ?? undefined

  const { sessionId } = usePaneBinding(activePaneId)

  const { data } = useQuery<SessionAnalyticsData>({
    queryKey: ['analytics-session', sessionId],
    queryFn: () => fetchSessionAnalytics(sessionId),
    staleTime: 25_000,
    refetchInterval: 30_000,
  })

  const buckets = data?.tokenRateBuckets ?? []
  const agentFanOut = data?.agentFanOut ?? 0
  const qualityPass = data?.qualityPass ?? 0
  const qualityFail = data?.qualityFail ?? 0

  return (
    <div className="flex flex-col gap-3 px-1 py-1">
      {/* Token rate sparkline */}
      <div>
        <span
          className="text-[10px] uppercase tracking-wider mb-1 block"
          style={{ color: 'var(--text-muted)' }}
        >
          token rate
        </span>
        <div
          aria-label="Token rate over last 60 minutes"
          role="img"
          style={{ height: '60px', width: '100%' }}
        >
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={buckets} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tokenRateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--cast-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--cast-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--cast-rail-border)',
                  borderRadius: '6px',
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                }}
                formatter={(value: number) => [`${value} tokens`, '']}
                labelFormatter={() => ''}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="var(--cast-accent)"
                strokeWidth={1.5}
                fill="url(#tokenRateGrad)"
                dot={false}
                isAnimationActive={!shouldReduceMotion}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent fan-out */}
      <div className="flex flex-col gap-0.5">
        <span
          className="text-2xl font-semibold font-mono tabular-nums"
          style={{ color: 'var(--text-primary)' }}
          aria-label={`${agentFanOut} agents this session`}
        >
          {agentFanOut}
        </span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          agents this session
        </span>
      </div>

      {/* Quality gate chips */}
      <div className="flex gap-2">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full"
          style={{
            background: 'rgba(52, 211, 153, 0.12)',
            color: 'var(--success)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
          }}
          aria-label={`${qualityPass} quality gates passed`}
        >
          ✓ {qualityPass} passed
        </span>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full"
          style={{
            background: 'rgba(248, 113, 113, 0.12)',
            color: 'var(--error)',
            border: '1px solid rgba(248, 113, 113, 0.25)',
          }}
          aria-label={`${qualityFail} quality gates failed`}
        >
          ✗ {qualityFail} failed
        </span>
      </div>
    </div>
  )
}
