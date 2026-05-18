import { useQuery } from '@tanstack/react-query'
import type { SessionAgentRun, PastSessionSummary } from '../types'
import { apiFetch } from './apiFetch'

// Fetch all agent runs for a given session
async function fetchSessionAgents(sessionId: string): Promise<{ runs: SessionAgentRun[] }> {
  return apiFetch<{ runs: SessionAgentRun[] }>(`/api/cast/session-agents/${encodeURIComponent(sessionId)}`)
}

export function useSessionAgents(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['cast', 'session-agents', sessionId],
    queryFn: () => fetchSessionAgents(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

// Fetch recent past sessions with their agent runs
async function fetchRecentSessions(limit = 10): Promise<{ sessions: PastSessionSummary[] }> {
  return apiFetch<{ sessions: PastSessionSummary[] }>(`/api/cast/session-agents?limit=${limit}`)
}

export function useRecentSessions(limit = 10) {
  return useQuery({
    queryKey: ['cast', 'recent-sessions', limit],
    queryFn: () => fetchRecentSessions(limit),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

// Fetch worktree info
async function fetchWorktrees(): Promise<{ worktrees: Array<{ path: string; branch: string | null; head: string }> }> {
  return apiFetch<{ worktrees: Array<{ path: string; branch: string | null; head: string }> }>('/api/cast/worktrees')
}

export function useWorktrees() {
  return useQuery({
    queryKey: ['cast', 'worktrees'],
    queryFn: fetchWorktrees,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
