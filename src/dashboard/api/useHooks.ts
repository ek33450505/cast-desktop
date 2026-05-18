import { useQuery } from '@tanstack/react-query'
import type { HookDefinition } from '../../types/index'
import { apiFetch } from './apiFetch'

export type { HookDefinition }

async function fetchHooks(): Promise<HookDefinition[]> {
  return apiFetch<HookDefinition[]>('/api/hooks')
}

export const useHooks = () =>
  useQuery({
    queryKey: ['hooks'],
    queryFn: fetchHooks,
    staleTime: 60_000,
  })
