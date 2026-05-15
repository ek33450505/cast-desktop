import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEvent } from '../../lib/SseManager'
import type { LiveEvent } from '../../types'

// ── types ─────────────────────────────────────────────────────────────────────

export type SectionKey =
  | 'agents' | 'skills' | 'rules' | 'plans' | 'commands'
  | 'memory' | 'hooks' | 'mcp' | 'research' | 'briefings'
  | 'reports' | 'scripts'

export interface FsItem {
  name: string
  path: string
  mtime: number
}

export interface MemoryItem extends FsItem {
  projectId: string
}

export interface HookItem {
  event: string
  script: string
  enabled: boolean
}

export interface McpItem {
  name: string
  command: string
  args: string[]
}

// ── fetchers ──────────────────────────────────────────────────────────────────

async function fetchSection<T>(section: SectionKey): Promise<T[]> {
  const res = await fetch(`/api/cast-fs/${section}`)
  if (!res.ok) throw new Error(`Failed to fetch ${section}`)
  return res.json() as Promise<T[]>
}

// ── SSE invalidation ──────────────────────────────────────────────────────────

/**
 * Listens to cast_fs_change SSE events and invalidates the matching castFs
 * query namespace so all subscribers refetch immediately.
 */
export function useCastFsSseInvalidation() {
  const queryClient = useQueryClient()

  useEvent<LiveEvent>('cast_fs_change', (e) => {
    if (e.fsPath) {
      const claudeRoot = '/.claude/'
      const idx = e.fsPath.indexOf(claudeRoot)
      if (idx !== -1) {
        const rel = e.fsPath.slice(idx + claudeRoot.length)
        const section = rel.split('/')[0] as SectionKey
        if (section) {
          void queryClient.invalidateQueries({ queryKey: ['castFs', section] })
        }
      }
    } else {
      // No path — invalidate the whole namespace
      void queryClient.invalidateQueries({ queryKey: ['castFs'] })
    }
  })
}

// ── per-section hooks ─────────────────────────────────────────────────────────
// All prefixed with useCastFs to avoid collisions with existing hooks
// (useAgents, useRules, useSkills, useCommands, usePlans all exist elsewhere).

export const useCastFsAgents = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'agents'],
    queryFn: () => fetchSection<FsItem>('agents'),
    staleTime: 60_000,
  })

export const useCastFsSkills = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'skills'],
    queryFn: () => fetchSection<FsItem>('skills'),
    staleTime: 60_000,
  })

export const useCastFsRules = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'rules'],
    queryFn: () => fetchSection<FsItem>('rules'),
    staleTime: 60_000,
  })

export const useCastFsPlans = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'plans'],
    queryFn: () => fetchSection<FsItem>('plans'),
    staleTime: 60_000,
  })

export const useCastFsCommands = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'commands'],
    queryFn: () => fetchSection<FsItem>('commands'),
    staleTime: 60_000,
  })

export const useCastFsMemory = () =>
  useQuery<MemoryItem[]>({
    queryKey: ['castFs', 'memory'],
    queryFn: () => fetchSection<MemoryItem>('memory'),
    staleTime: 60_000,
  })

export const useCastFsHooks = () =>
  useQuery<HookItem[]>({
    queryKey: ['castFs', 'hooks'],
    queryFn: () => fetchSection<HookItem>('hooks'),
    staleTime: 60_000,
  })

export const useCastFsMcp = () =>
  useQuery<McpItem[]>({
    queryKey: ['castFs', 'mcp'],
    queryFn: () => fetchSection<McpItem>('mcp'),
    staleTime: 60_000,
  })

export const useCastFsResearch = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'research'],
    queryFn: () => fetchSection<FsItem>('research'),
    staleTime: 60_000,
  })

export const useCastFsBriefings = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'briefings'],
    queryFn: () => fetchSection<FsItem>('briefings'),
    staleTime: 60_000,
  })

export const useCastFsReports = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'reports'],
    queryFn: () => fetchSection<FsItem>('reports'),
    staleTime: 60_000,
  })

export const useCastFsScripts = () =>
  useQuery<FsItem[]>({
    queryKey: ['castFs', 'scripts'],
    queryFn: () => fetchSection<FsItem>('scripts'),
    staleTime: 60_000,
  })

// ── unified hook ──────────────────────────────────────────────────────────────

/**
 * Fetches all 12 sections and wires SSE invalidation.
 * Returns a partial record keyed by SectionKey.
 * Callers narrow item types at the use site.
 */
export function useCastFsSections(): Partial<Record<SectionKey, FsItem[] | MemoryItem[] | HookItem[] | McpItem[]>> {
  // Wire SSE invalidation once at the unified hook level
  useCastFsSseInvalidation()

  const agents = useCastFsAgents()
  const skills = useCastFsSkills()
  const rules = useCastFsRules()
  const plans = useCastFsPlans()
  const commands = useCastFsCommands()
  const memory = useCastFsMemory()
  const hooks = useCastFsHooks()
  const mcp = useCastFsMcp()
  const research = useCastFsResearch()
  const briefings = useCastFsBriefings()
  const reports = useCastFsReports()
  const scripts = useCastFsScripts()

  return {
    agents: agents.data,
    skills: skills.data,
    rules: rules.data,
    plans: plans.data,
    commands: commands.data,
    memory: memory.data,
    hooks: hooks.data,
    mcp: mcp.data,
    research: research.data,
    briefings: briefings.data,
    reports: reports.data,
    scripts: scripts.data,
  }
}
