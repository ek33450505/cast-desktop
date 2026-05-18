import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface HookFailureRow {
  id: string
  hook_name: string
  exit_code: number
  stderr: string | null
  session_id: string | null
  timestamp: string
}

async function fetchHookFailures(since?: string): Promise<{ failures: HookFailureRow[] }> {
  const url = since ? `/api/hook-failures?since=${encodeURIComponent(since)}` : '/api/hook-failures'
  return apiFetch<{ failures: HookFailureRow[] }>(url)
}

async function fetchHookFailureCount(): Promise<{ count: number }> {
  const res = await fetch('/api/hook-failures/count')
  if (!res.ok) return { count: 0 }
  return res.json()
}

export const useHookFailures = (since?: string) =>
  useQuery({
    queryKey: ['hook-failures', since],
    queryFn: () => fetchHookFailures(since),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

export const useHookFailureCount = () =>
  useQuery({
    queryKey: ['hook-failures', 'count'],
    queryFn: fetchHookFailureCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
