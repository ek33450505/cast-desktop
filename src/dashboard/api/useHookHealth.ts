import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface HookHealthEntry {
  hook_type: string
  command: string
  script_path: string | null
  exists: boolean
  executable: boolean
  last_fired_at: string | null
  health: 'green' | 'yellow' | 'red'
}

export interface HookHealthData {
  hooks: HookHealthEntry[]
}

async function fetchHookHealth(): Promise<HookHealthData> {
  return apiFetch<HookHealthData>('/api/hooks/health')
}

export const useHookHealth = () =>
  useQuery({
    queryKey: ['hooks', 'health'],
    queryFn: fetchHookHealth,
    staleTime: 30_000,
  })
