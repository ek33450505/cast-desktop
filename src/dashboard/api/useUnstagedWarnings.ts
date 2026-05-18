import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface UnstagedWarning {
  id: number
  timestamp: string
  session_id: string | null
  commit_sha: string | null
  unstaged_files: string | null
  in_scope_files: string | null
}

export function useUnstagedWarnings() {
  return useQuery<{ warnings: UnstagedWarning[] }>({
    queryKey: ['unstaged-warnings'],
    queryFn: () => apiFetch<{ warnings: UnstagedWarning[] }>('/api/unstaged-warnings'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
