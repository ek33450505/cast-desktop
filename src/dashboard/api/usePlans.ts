import { useQuery } from '@tanstack/react-query'
import type { PlanFile } from '../types'
import { apiFetch } from './apiFetch'

async function fetchPlans(): Promise<PlanFile[]> {
  return apiFetch<PlanFile[]>('/api/plans')
}

async function fetchPlan(filename: string): Promise<PlanFile & { body: string }> {
  return apiFetch<PlanFile & { body: string }>(`/api/plans/${encodeURIComponent(filename)}`)
}

export const usePlans = () =>
  useQuery({ queryKey: ['plans'], queryFn: fetchPlans })

export const usePlan = (filename: string) =>
  useQuery({
    queryKey: ['plans', filename],
    queryFn: () => fetchPlan(filename),
    enabled: !!filename,
  })
