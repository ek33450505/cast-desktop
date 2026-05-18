import { useQuery } from '@tanstack/react-query'
import type { SystemOverview } from '../types'
import { apiFetch } from './apiFetch'

async function fetchHealth(): Promise<SystemOverview> {
  return apiFetch<SystemOverview>('/api/health')
}

async function fetchConfig(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/api/config')
}

export const useSystemHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: fetchHealth })

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: fetchConfig })
