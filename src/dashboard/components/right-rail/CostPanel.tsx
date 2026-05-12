import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { usePaneBinding } from '../../../hooks/usePaneBinding'
import { useTerminalStore } from '../../../stores/terminalStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionCostData {
  totalUsd: number
  burnRatePerMin: number
  projectedFourHourUsd: number
  budgetUsd: number | null
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchSessionCost(sessionId: string | null): Promise<SessionCostData> {
  const url = sessionId
    ? `/api/session-cost?sessionId=${encodeURIComponent(sessionId)}`
    : '/api/session-cost'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch session cost: HTTP ${res.status}`)
  return res.json() as Promise<SessionCostData>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

const burnFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
})

function formatCurrency(val: number): string {
  return currencyFmt.format(val)
}

function formatBurnRate(val: number): string {
  return burnFmt.format(val)
}

// ── CostPanel ─────────────────────────────────────────────────────────────────

export default function CostPanel() {
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()

  // Store-read pattern: activeTabId → tab.paneId → usePaneBinding → sessionId
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activePaneId = activeTab?.paneId ?? undefined

  const { sessionId } = usePaneBinding(activePaneId)

  const { data } = useQuery<SessionCostData>({
    queryKey: ['session-cost', sessionId],
    queryFn: () => fetchSessionCost(sessionId),
    staleTime: 8_000,
  })

  // SSE subscription — invalidate query on update
  useEffect(() => {
    if (!sessionId) return

    const url = `/api/session-cost/stream?sessionId=${encodeURIComponent(sessionId)}`
    const es = new EventSource(url)

    es.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ['session-cost', sessionId] })
    }

    es.onerror = () => {
      console.error('Session cost SSE stream error')
      es.close()
    }

    return () => {
      es.close()
    }
  }, [sessionId, queryClient])

  const total = data?.totalUsd ?? 0
  const burnRate = data?.burnRatePerMin ?? 0
  const projection = data?.projectedFourHourUsd ?? 0
  const budgetUsd = data?.budgetUsd ?? null

  // Budget gauge — only rendered if budgetUsd is set (currently always null)
  const gaugePercent = budgetUsd != null && budgetUsd > 0
    ? Math.min(1, total / budgetUsd)
    : null

  return (
    <div className="flex flex-col gap-3 px-1 py-1">
      {/* Total cost — primary number */}
      <div className="flex flex-col gap-0.5">
        <span
          className="text-xl font-semibold font-mono tabular-nums"
          style={{ color: 'var(--accent)' }}
          aria-live="polite"
          aria-label={`Session cost: ${formatCurrency(total)}`}
        >
          {formatCurrency(total)}
        </span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          session total
        </span>
      </div>

      {/* Burn rate + projection */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            burn rate
          </span>
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: 'var(--text-secondary)' }}
          >
            {formatBurnRate(burnRate)}<span className="text-[10px]">/min</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            4h projection
          </span>
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: 'var(--text-secondary)' }}
          >
            {formatCurrency(projection)}
          </span>
        </div>
      </div>

      {/* Budget gauge — only renders when budgetUsd is set */}
      {gaugePercent != null && (
        <BudgetGauge
          percent={gaugePercent}
          totalUsd={total}
          budgetUsd={budgetUsd!}
          animate={!shouldReduceMotion}
        />
      )}
    </div>
  )
}

// ── BudgetGauge ───────────────────────────────────────────────────────────────
// Lazy import Recharts only when gauge is actually needed (budgetUsd present)

interface BudgetGaugeProps {
  percent: number
  totalUsd: number
  budgetUsd: number
  animate: boolean
}

function BudgetGauge({ percent, totalUsd, budgetUsd, animate }: BudgetGaugeProps) {
  const { RadialBarChart, RadialBar, PolarAngleAxis } = require('recharts') as typeof import('recharts')

  const filledValue = Math.round(percent * 100)

  return (
    <div
      aria-label={`Budget usage: ${formatCurrency(totalUsd)} of ${formatCurrency(budgetUsd)} budget`}
      role="img"
    >
      <RadialBarChart
        width={120}
        height={70}
        cx={60}
        cy={65}
        innerRadius={45}
        outerRadius={60}
        startAngle={180}
        endAngle={0}
        data={[{ value: filledValue }]}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: 'var(--bg-tertiary)' }}
          dataKey="value"
          angleAxisId={0}
          fill="var(--cast-accent)"
          isAnimationActive={animate}
        />
      </RadialBarChart>
      <p className="text-center text-[10px]" style={{ color: 'var(--text-muted)', marginTop: '-8px' }}>
        {Math.round(percent * 100)}% of budget
      </p>
    </div>
  )
}
