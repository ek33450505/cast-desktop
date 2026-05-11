import { useQuery } from '@tanstack/react-query'
import type { PlanFile } from '../types'

async function fetchPlans(): Promise<PlanFile[]> {
  const res = await fetch('/api/plans')
  if (!res.ok) throw new Error('Failed to fetch plans')
  return res.json()
}

async function fetchPlan(filename: string): Promise<PlanFile & { body: string }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error('Failed to fetch plan')
  return res.json()
}

export const usePlans = () =>
  useQuery({ queryKey: ['plans'], queryFn: fetchPlans })

export const usePlan = (filename: string) =>
  useQuery({
    queryKey: ['plans', filename],
    queryFn: () => fetchPlan(filename),
    enabled: !!filename,
  })
