import { useQuery } from '@tanstack/react-query'

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
  const res = await fetch('/api/incidents')
  if (!res.ok) throw new Error('Failed to fetch incidents')
  return res.json()
}

export const useIncidents = () =>
  useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    staleTime: 60_000,
  })
