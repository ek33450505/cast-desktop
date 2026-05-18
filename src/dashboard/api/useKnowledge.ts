import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

interface RuleFile {
  filename: string
  path: string
  preview: string
  modifiedAt: string
}

interface SkillFile {
  name: string
  description: string
  path: string
  modifiedAt: string
}

interface CommandFile {
  name: string
  preview: string
  path: string
  modifiedAt: string
}

async function fetchRules(): Promise<RuleFile[]> {
  return apiFetch<RuleFile[]>('/api/rules')
}

async function fetchSkills(): Promise<SkillFile[]> {
  return apiFetch<SkillFile[]>('/api/skills')
}

async function fetchCommands(): Promise<CommandFile[]> {
  return apiFetch<CommandFile[]>('/api/commands')
}

async function fetchFileContent(url: string): Promise<{ body: string }> {
  return apiFetch<{ body: string }>(url)
}

export const useRules = () =>
  useQuery({ queryKey: ['rules'], queryFn: fetchRules })

export const useSkills = () =>
  useQuery({ queryKey: ['skills'], queryFn: fetchSkills })

export const useCommands = () =>
  useQuery({ queryKey: ['commands'], queryFn: fetchCommands })

export const useFileContent = (url: string) =>
  useQuery({
    queryKey: ['file-content', url],
    queryFn: () => fetchFileContent(url),
    enabled: !!url,
  })
