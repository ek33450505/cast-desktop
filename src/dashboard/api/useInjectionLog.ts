import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface InjectionLogEntry {
  id: number
  session_id: string | null
  prompt_hash: string
  fact_id: number
  score: number | null
  injected_at: string
}

export function useInjectionLog() {
  return useQuery<{ entries: InjectionLogEntry[] }>({
    queryKey: ['injection-log'],
    queryFn: () => apiFetch<{ entries: InjectionLogEntry[] }>('/api/injection-log'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
