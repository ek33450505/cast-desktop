import { useQuery } from '@tanstack/react-query'
import type { HallucinationRow } from './useAgentHallucinations'

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function fetchHallucinationDetail(id: number): Promise<HallucinationRow> {
  const res = await fetch(`/api/agent-hallucinations/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch hallucination detail for id ${id}`)
  return res.json()
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
