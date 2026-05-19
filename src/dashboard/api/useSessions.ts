import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Session, LogEntry } from '../types'
import { apiFetch } from './apiFetch'

async function fetchSessions(project?: string, limit?: number): Promise<Session[]> {
  const params = new URLSearchParams()
  if (project) params.set('project', project)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return apiFetch<Session[]>(`/api/sessions${qs ? `?${qs}` : ''}`)
}

async function fetchSessionEntries(project: string, id: string): Promise<LogEntry[]> {
  return apiFetch<LogEntry[]>(`/api/sessions/${project}/${id}`)
}

async function deleteSession(projectEncoded: string, sessionId: string): Promise<{ id: string; deleted_at: string }> {
  return apiFetch<{ id: string; deleted_at: string }>(`/api/sessions/${projectEncoded}/${sessionId}`, {
    method: 'DELETE',
  })
}

export const useSessions = (project?: string, limit?: number) =>
  useQuery({
    queryKey: ['sessions', project, limit],
    queryFn: () => fetchSessions(project, limit),
  })

export const useSession = (project: string, id: string) =>
  useQuery({
    queryKey: ['sessions', project, id],
    queryFn: () => fetchSessionEntries(project, id),
    enabled: !!project && !!id,
  })

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectEncoded, sessionId }: { projectEncoded: string; sessionId: string }) =>
      deleteSession(projectEncoded, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
