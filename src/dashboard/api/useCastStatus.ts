import { useQuery } from '@tanstack/react-query'

export interface CastStatus {
  castInstalled: boolean
  dbExists: boolean
  dbHasData: boolean
  dbPath: string
}

async function fetchCastStatus(): Promise<CastStatus> {
  const res = await fetch('/api/system/cast-status')
  if (!res.ok) throw new Error('Failed to fetch cast status')
  return res.json()
}

export function useCastStatus() {
  return useQuery({
    queryKey: ['cast-status'],
    queryFn: fetchCastStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
