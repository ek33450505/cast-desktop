import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface ParryGuardEvent {
  id: number
  tool_name: string
  input_snippet: string | null
  rejected_at: string
}

export function useParryGuard() {
  return useQuery<{ events: ParryGuardEvent[] }>({
    queryKey: ['parry-guard'],
    queryFn: () => apiFetch<{ events: ParryGuardEvent[] }>('/api/parry-guard'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
