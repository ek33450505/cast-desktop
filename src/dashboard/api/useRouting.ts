import { useQuery } from '@tanstack/react-query'
import type { DispatchEvent } from '../types'
import { apiFetch } from './apiFetch'

export interface DispatchStats {
  total: number
  completed: number
  failed: number
  topAgent: string
  last24hCount: number
}

export function useDispatchEvents(limit = 500) {
  return useQuery<DispatchEvent[]>({
    queryKey: ['routing', 'events', limit],
    queryFn: () => apiFetch<DispatchEvent[]>(`/api/routing/events?limit=${limit}`),
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}

export function useRoutingStats() {
  return useQuery<DispatchStats>({
    queryKey: ['routing', 'stats'],
    queryFn: () => apiFetch<DispatchStats>('/api/routing/stats'),
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}
