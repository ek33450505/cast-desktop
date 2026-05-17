import { useQuery } from '@tanstack/react-query'
import type { HookDefinition } from '../../types/index'

export type { HookDefinition }

async function fetchHooks(): Promise<HookDefinition[]> {
  const res = await fetch('/api/hooks')
  if (!res.ok) throw new Error('Failed to fetch hooks')
  return res.json()
}

export const useHooks = () =>
  useQuery({
    queryKey: ['hooks'],
    queryFn: fetchHooks,
    staleTime: 60_000,
  })
