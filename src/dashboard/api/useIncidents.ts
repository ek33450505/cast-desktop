import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface IncidentRow {
  id: string
  occurred_at: string
  problem_summary: string
  fix_summary: string | null
  related_files: string | null
  related_commit: string | null
  resolution_status: string | null
  surfaced_by: string | null
}

async function fetchIncidents(): Promise<{ incidents: IncidentRow[] }> {
  return apiFetch<{ incidents: IncidentRow[] }>('/api/incidents')
}

export const useIncidents = () =>
  useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    staleTime: 60_000,
  })
