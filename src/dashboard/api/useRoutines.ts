import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoutineRow {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  agent: string
  output_dir: string
  enabled: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_output_path: string | null
  created_at: string
}

export interface RoutinesData {
  routines: RoutineRow[]
}

export interface RoutineOutputData {
  content: string | null
  reason?: 'not_found' | 'too_large'
  path?: string
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function fetchRoutines(): Promise<RoutinesData> {
  return apiFetch<RoutinesData>('/api/routines')
}

async function fetchRoutineOutput(id: string): Promise<RoutineOutputData> {
  return apiFetch<RoutineOutputData>(`/api/routines/${encodeURIComponent(id)}/output`)
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useRoutines() {
  return useQuery({
    queryKey: ['routines'],
    queryFn: fetchRoutines,
    staleTime: 30_000,
  })
}

export function useRoutineOutput(id: string | null, enabled = false) {
  return useQuery({
    queryKey: ['routines', 'output', id],
    queryFn: () => fetchRoutineOutput(id!),
    enabled: enabled && !!id,
    staleTime: 60_000,
  })
}
