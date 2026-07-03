import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface DispatchDecision {
  id: number
  session_id: string | null
  prompt_snippet: string | null
  chosen_agent: string | null
  model: string | null
  effort: string | null
  wave_id: string | null
  parallel: number
  created_at: string
  outcome: string | null
}

export function useDispatchDecisions() {
  return useQuery<{ decisions: DispatchDecision[] }>({
    queryKey: ['dispatch-decisions'],
    queryFn: () => apiFetch<{ decisions: DispatchDecision[] }>('/api/dispatch-decisions'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
