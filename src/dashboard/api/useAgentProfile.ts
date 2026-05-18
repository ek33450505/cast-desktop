import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface AgentRunRow {
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  status: string
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number
  task_summary: string | null
  model: string | null
  is_truncated: number
}

export interface AgentProfileDetail {
  name: string
  runs: number
  success_rate: number
  blocked_count: number
  avg_cost_usd: number
  last_runs: AgentRunRow[]
}

async function fetchAgentProfile(agent: string): Promise<AgentProfileDetail> {
  return apiFetch<AgentProfileDetail>(`/api/analytics/profile/${encodeURIComponent(agent)}`)
}

export const useAgentProfile = (agent: string) =>
  useQuery({
    queryKey: ['analytics', 'profile', agent],
    queryFn: () => fetchAgentProfile(agent),
    staleTime: 60_000,
    enabled: !!agent,
  })

export interface AgentScorecardRow {
  name: string
  runs: number
  success_rate: number
  blocked_count: number
  avg_cost_usd: number
}

async function fetchAgentScorecard(): Promise<{ agents: AgentScorecardRow[] }> {
  return apiFetch<{ agents: AgentScorecardRow[] }>('/api/analytics/profile')
}

export const useAgentScorecard = () =>
  useQuery({
    queryKey: ['analytics', 'scorecard'],
    queryFn: fetchAgentScorecard,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
