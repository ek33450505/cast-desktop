import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

interface GitBranchResponse {
  branch: string | null
}

async function fetchGitBranch(): Promise<GitBranchResponse> {
  return apiFetch<GitBranchResponse>('/api/git/branch')
}

/**
 * Returns the current git branch for the project root that the API server is
 * running in. Refetches every 30 seconds — branch changes are infrequent but
 * the user may switch branches during a session.
 *
 * Returns `null` for `branch` when git is unavailable or the cwd is not a
 * git repository (server returns { branch: null } in that case).
 */
export function useGitBranch() {
  return useQuery({
    queryKey: ['git', 'branch'],
    queryFn: fetchGitBranch,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
