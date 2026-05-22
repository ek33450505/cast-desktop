import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

interface GitUserResponse {
  name: string | null
}

async function fetchGitUser(): Promise<GitUserResponse> {
  return apiFetch<GitUserResponse>('/api/git/user')
}

/**
 * Returns the git global user.name. Cached for 5 minutes — git config rarely
 * changes during a session. Returns null for `name` when git is unavailable or
 * user.name is not configured.
 */
export function useGitUser() {
  return useQuery({
    queryKey: ['git', 'user'],
    queryFn: fetchGitUser,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  })
}
