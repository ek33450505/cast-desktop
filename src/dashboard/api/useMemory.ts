import { useQuery } from '@tanstack/react-query'
import type { MemoryFile } from '../types'
import { apiFetch } from './apiFetch'

async function fetchAgentMemory(): Promise<MemoryFile[]> {
  return apiFetch<MemoryFile[]>('/api/memory/agent')
}

async function fetchProjectMemory(): Promise<MemoryFile[]> {
  return apiFetch<MemoryFile[]>('/api/memory/project')
}

export const useAgentMemory = () =>
  useQuery({ queryKey: ['memory', 'agent'], queryFn: fetchAgentMemory })

export const useProjectMemory = () =>
  useQuery({ queryKey: ['memory', 'project'], queryFn: fetchProjectMemory })
