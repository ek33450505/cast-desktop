import { useQuery } from '@tanstack/react-query'
import type {
  QualityGateStats,
  CompactionEvent,
  ToolFailure,
  ToolFailureStats,
  ResearchCacheStats,
  DbMemory,
} from '../types'
import { apiFetch } from './apiFetch'

// ── Quality Gates ────────────────────────────────────────────────────────────

export function useQualityGateStats() {
  return useQuery<QualityGateStats>({
    queryKey: ['quality-gates', 'stats'],
    queryFn: () => apiFetch<QualityGateStats>('/api/quality-gates/stats'),
    staleTime: 60_000,
  })
}

// ── Compaction Events ────────────────────────────────────────────────────────

export function useCompactionEvents() {
  return useQuery({
    queryKey: ['compaction-events'],
    queryFn: async () => {
      const data = await apiFetch<{ events: CompactionEvent[] }>('/api/cast/compaction-events')
      return data.events
    },
    staleTime: 60_000,
  })
}

// ── Tool Failures ────────────────────────────────────────────────────────────

export function useToolFailures(options?: { limit?: number; since?: string }) {
  return useQuery({
    queryKey: ['tool-failures', options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.since) params.set('since', options.since)
      const data = await apiFetch<{ failures: ToolFailure[]; total: number }>(`/api/cast/tool-failures?${params}`)
      return { failures: data.failures, total: data.total }
    },
    staleTime: 60_000,
  })
}

export function useToolFailureStats() {
  return useQuery<ToolFailureStats>({
    queryKey: ['tool-failures', 'stats'],
    queryFn: () => apiFetch<ToolFailureStats>('/api/cast/tool-failures/stats'),
    staleTime: 60_000,
  })
}

// ── Research Cache ───────────────────────────────────────────────────────────

export function useResearchCacheStats() {
  return useQuery<ResearchCacheStats>({
    queryKey: ['research-cache', 'stats'],
    queryFn: () => apiFetch<ResearchCacheStats>('/api/cast/research-cache/stats'),
    staleTime: 120_000,
  })
}

// ── DB Memories (with importance/decay/retrieval) ────────────────────────────

export function useDbMemories() {
  return useQuery({
    queryKey: ['db-memories'],
    queryFn: async () => {
      const data = await apiFetch<{ memories: DbMemory[] }>('/api/memory/db-memories')
      return data.memories
    },
    staleTime: 120_000,
  })
}

// ── Config ───────────────────────────────────────────────────────────────────

export function useChainMap() {
  return useQuery<Record<string, string[]>>({
    queryKey: ['config', 'chain-map'],
    queryFn: async () => {
      const res = await fetch('/api/config/chain-map')
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
  })
}

export function usePolicies() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['config', 'policies'],
    queryFn: async () => {
      const res = await fetch('/api/config/policies')
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
  })
}

export function useModelPricing() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['config', 'model-pricing'],
    queryFn: async () => {
      const res = await fetch('/api/config/model-pricing')
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
  })
}

