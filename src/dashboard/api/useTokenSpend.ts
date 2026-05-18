import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface TokenSpendDaily {
  date: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface TokenSpendTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

export interface TokenSpendData {
  daily: TokenSpendDaily[]
  totals: TokenSpendTotals
}

async function fetchTokenSpend(): Promise<TokenSpendData> {
  return apiFetch<TokenSpendData>('/api/cast/token-spend')
}

export const useTokenSpend = () =>
  useQuery({
    queryKey: ['cast', 'token-spend'],
    queryFn: fetchTokenSpend,
    staleTime: 60_000,
  })
