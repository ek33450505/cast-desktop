import { useQuery } from '@tanstack/react-query'
import type { AgentDefinition } from '../types'
import { apiFetch } from './apiFetch'

async function fetchAgents(): Promise<AgentDefinition[]> {
  return apiFetch<AgentDefinition[]>('/api/agents')
}

async function fetchAgent(name: string): Promise<AgentDefinition & { body: string }> {
  return apiFetch<AgentDefinition & { body: string }>(`/api/agents/${name}`)
}

export const useAgents = () =>
  useQuery({ queryKey: ['agents'], queryFn: fetchAgents, staleTime: 60_000 })

export const useAgent = (name: string) =>
  useQuery({ queryKey: ['agents', name], queryFn: () => fetchAgent(name), enabled: !!name })
