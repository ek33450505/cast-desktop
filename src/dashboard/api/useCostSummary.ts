import { useQuery } from '@tanstack/react-query'

export interface CostSummaryTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

export interface ModelBreakdownEntry {
  model: string
  costUsd: number
  sessionCount: number
}

export interface TopSessionEntry {
  id: string
  project: string
  startedAt: string
  model: string
  costUsd: number
}

export interface CostSummaryData {
  totals: CostSummaryTotals
  byModel: ModelBreakdownEntry[]
  topSessions: TopSessionEntry[]
  windowDays: number
}

async function fetchCostSummary(days = 30): Promise<CostSummaryData> {
  const res = await fetch(`/api/cast/cost-summary?days=${days}`)
  if (!res.ok) throw new Error('Failed to fetch cost summary')
  return res.json()
}

export const useCostSummary = (days = 30) =>
  useQuery({
    queryKey: ['cast', 'cost-summary', days],
    queryFn: () => fetchCostSummary(days),
    staleTime: 60_000,
  })
