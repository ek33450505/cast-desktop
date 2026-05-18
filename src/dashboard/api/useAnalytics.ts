import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface DelegationSavings {
  savedUSD: number
  hypotheticalSonnetCostUSD: number
  actualCostUSD: number
  haikuUtilizationPct: number
  dispatches: { haiku: number; sonnet: number; opus: number }
}

export interface AnalyticsData {
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  estimatedCostUSD: number
  sessionsByDay: Array<{ date: string; sessions: number; inputTokens: number; outputTokens: number; cost: number }>
  sessionsByProject: Array<{ project: string; sessions: number; tokens: number; cost: number }>
  toolUsage: Array<{ tool: string; count: number }>
  modelBreakdown: Array<{ model: string; sessions: number; tokens: number; cost: number }>
  avgSessionDurationMs: number
  avgTokensPerSession: number
  delegationSavings?: DelegationSavings
  monthPrefix?: string | null
}

async function fetchAnalytics(currentMonthOnly = true): Promise<AnalyticsData> {
  const url = currentMonthOnly ? '/api/analytics?currentMonthOnly=true' : '/api/analytics'
  return apiFetch<AnalyticsData>(url)
}

export const useAnalytics = (currentMonthOnly = true) =>
  useQuery({
    queryKey: ['analytics', currentMonthOnly],
    queryFn: () => fetchAnalytics(currentMonthOnly),
    staleTime: 120_000, // 2 minutes
  })
