import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface AgentTruncation {
  id: number
  session_id: string | null
  agent_type: string
  agent_id: string | null
  last_line: string | null
  timestamp: string
  char_count: number | null
  has_status: number | null
  has_json: number | null
}

export function useAgentTruncations() {
  return useQuery<{ truncations: AgentTruncation[] }>({
    queryKey: ['agent-truncations'],
    queryFn: () => apiFetch<{ truncations: AgentTruncation[] }>('/api/agent-truncations'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
