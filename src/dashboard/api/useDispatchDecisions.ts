import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface DispatchDecision {
  id: string
  session_id: string | null
  timestamp: string
  dispatch_backend: string | null
  plan_file: string | null
}

export function useDispatchDecisions() {
  return useQuery<{ decisions: DispatchDecision[] }>({
    queryKey: ['dispatch-decisions'],
    queryFn: () => apiFetch<{ decisions: DispatchDecision[] }>('/api/dispatch-decisions'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
