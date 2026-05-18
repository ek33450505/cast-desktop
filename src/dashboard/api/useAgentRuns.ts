import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface AgentRun {
  id: number | string
  agent_id?: string
  session_id: string
  agent: string
  model: string
  started_at: string
  ended_at: string | null
  status: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  task_summary: string | null
  project: string | null
}

export interface AgentRunStats {
  totalRuns: number
  totalCostUsd: number
  byAgent: Record<string, number>
  byStatus: Record<string, number>
}

export interface AgentRunsData {
  runs: AgentRun[]
  stats: AgentRunStats
}

export interface AgentRunsParams {
  limit?: number
  agent?: string
  status?: string
  since?: string
  refetchInterval?: number
}

async function fetchAgentRuns(params: AgentRunsParams): Promise<AgentRunsData> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.agent) searchParams.set('agent', params.agent)
  if (params.status) searchParams.set('status', params.status)
  if (params.since) searchParams.set('since', params.since)
  const url = `/api/cast/agent-runs${searchParams.toString() ? `?${searchParams}` : ''}`
  return apiFetch<AgentRunsData>(url)
}

export const useAgentRuns = (params: AgentRunsParams = {}) =>
  useQuery({
    queryKey: ['cast', 'agent-runs', params],
    queryFn: () => fetchAgentRuns(params),
    refetchInterval: params.refetchInterval ?? 60_000,
    refetchIntervalInBackground: false,
  })
