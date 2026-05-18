import { useQuery } from '@tanstack/react-query'
import type { SwarmSession, TeammateRun, TeammateMessage } from '../types'
import { apiFetch } from './apiFetch'

// ── Swarm Sessions List ───────────────────────────────────────────────────────

interface SwarmSessionsResponse {
  sessions: SwarmSession[]
}

interface SwarmMessagesResponse {
  messages: TeammateMessage[]
}

export function useSwarmSessions() {
  return useQuery<SwarmSession[]>({
    queryKey: ['swarm', 'sessions'],
    queryFn: () =>
      apiFetch<SwarmSessionsResponse>('/api/swarm/sessions').then((data) => data.sessions),
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}

// ── Swarm Session Detail ──────────────────────────────────────────────────────

export interface SwarmDetail {
  session: SwarmSession
  teammates: TeammateRun[]
}

export function useSwarmDetail(id: string | null) {
  return useQuery<SwarmDetail>({
    queryKey: ['swarm', 'sessions', id],
    queryFn: () => apiFetch<SwarmDetail>(`/api/swarm/sessions/${id}`),
    enabled: id !== null,
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}

// ── Swarm Messages ────────────────────────────────────────────────────────────

export function useSwarmMessages(id: string | null) {
  return useQuery<TeammateMessage[]>({
    queryKey: ['swarm', 'sessions', id, 'messages'],
    queryFn: () =>
      apiFetch<SwarmMessagesResponse>(`/api/swarm/sessions/${id}/messages`).then(
        (data) => data.messages,
      ),
    enabled: id !== null,
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}
