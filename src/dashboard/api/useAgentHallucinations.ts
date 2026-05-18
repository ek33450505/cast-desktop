import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HallucinationRow {
  id: number
  session_id: string | null
  agent_name: string
  claim_type: string
  claimed_value: string | null
  actual_value: string | null
  verified: number
  timestamp: string
}

export interface HallucinationSummaryRow {
  agent_name: string
  total: number
  verified: number
  unverified: number
}

export interface HallucinationFilters {
  agent?: string
  claim_type?: string
  verified?: '0' | '1' | null
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export interface HallucinationsData {
  hallucinations: HallucinationRow[]
  total: number
}

export interface HallucinationsSummaryData {
  byAgent: HallucinationSummaryRow[]
  total: number
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function fetchHallucinationsSummary(): Promise<HallucinationsSummaryData> {
  return apiFetch<HallucinationsSummaryData>('/api/agent-hallucinations/summary')
}

async function fetchHallucinations(filters: HallucinationFilters): Promise<HallucinationsData> {
  const params = new URLSearchParams()
  if (filters.agent) params.set('agent', filters.agent)
  if (filters.claim_type) params.set('claim_type', filters.claim_type)
  if (filters.verified != null) params.set('verified', filters.verified)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))

  const qs = params.toString()
  return apiFetch<HallucinationsData>(`/api/agent-hallucinations${qs ? `?${qs}` : ''}`)
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useAgentHallucinationsSummary() {
  return useQuery({
    queryKey: ['agent-hallucinations', 'summary'],
    queryFn: fetchHallucinationsSummary,
    staleTime: 60_000,
  })
}

export function useAgentHallucinations(filters: HallucinationFilters) {
  return useQuery({
    queryKey: ['agent-hallucinations', filters],
    queryFn: () => fetchHallucinations(filters),
    staleTime: 60_000,
  })
}
