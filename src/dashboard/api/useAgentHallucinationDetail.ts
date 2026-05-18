import { useQuery } from '@tanstack/react-query'
import type { HallucinationRow } from './useAgentHallucinations'
import { apiFetch } from './apiFetch'

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function fetchHallucinationDetail(id: number): Promise<HallucinationRow> {
  return apiFetch<HallucinationRow>(`/api/agent-hallucinations/${id}`)
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAgentHallucinationDetail(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ['agent-hallucinations', 'detail', id],
    queryFn: () => fetchHallucinationDetail(id),
    enabled,
    staleTime: 300_000,
  })
}
