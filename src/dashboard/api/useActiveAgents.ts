import { useQuery } from '@tanstack/react-query'
import type { AgentRun } from './useAgentRuns'
import { apiFetch } from './apiFetch'

async function fetchActiveAgents(): Promise<AgentRun[]> {
  const data = await apiFetch<{ runs: AgentRun[] }>('/api/cast/active-agents')
  return data.runs
}

export const useActiveAgents = () =>
  useQuery({
    queryKey: ['cast', 'active-agents'],
    queryFn: fetchActiveAgents,
    refetchInterval: 5_000,
    staleTime: 3_000,
    refetchIntervalInBackground: false,
  })
