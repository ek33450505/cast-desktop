import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEvent } from '../../../lib/SseManager'
import type { LiveEvent } from '../../../types'
import {
  Bot,
  Wrench,
  BookOpen,
  Brain,
  ClipboardList,
  Terminal,
  Plug,
  ChevronDown,
  ChevronRight,
  Webhook,
  FolderOpen,
} from 'lucide-react'
import ProjectFsTree from './ProjectFsTree'

// ── types ─────────────────────────────────────────────────────────────────────

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

export type SectionId = 'agents' | 'skills' | 'rules' | 'plans' | 'commands' | 'memory' | 'hooks' | 'mcp'

export interface PreviewTarget {
  section: SectionId
  name: string
  path: string
  source?: 'cast' | 'project'
}

interface CastFsTreeProps {
  onPreview: (target: PreviewTarget, triggerEl?: HTMLElement) => void
}

// ── section config ────────────────────────────────────────────────────────────

interface SectionConfig {
  id: SectionId
  label: string
  Icon: React.ElementType
}

const SECTIONS: SectionConfig[] = [
  { id: 'agents',   label: 'Agents',   Icon: Bot },
  { id: 'skills',   label: 'Skills',   Icon: Wrench },
  { id: 'rules',    label: 'Rules',    Icon: BookOpen },
  { id: 'plans',    label: 'Plans',    Icon: ClipboardList },
  { id: 'commands', label: 'Commands', Icon: Terminal },
  { id: 'memory',   label: 'Memory',   Icon: Brain },
  { id: 'hooks',    label: 'Hooks',    Icon: Webhook },
  { id: 'mcp',      label: 'MCP',      Icon: Plug },
]

// ── fetchers ──────────────────────────────────────────────────────────────────

async function fetchSection(section: SectionId): Promise<FsItem[] | MemoryItem[] | HookItem[] | McpItem[]> {
  const res = await fetch(`/api/cast-fs/${section}`)
  if (!res.ok) throw new Error(`Failed to fetch ${section}`)
  return res.json() as Promise<FsItem[] | MemoryItem[] | HookItem[] | McpItem[]>
}

function useCastFs(section: SectionId) {
  return useQuery({
    queryKey: ['castFs', section],
    queryFn: () => fetchSection(section),
    staleTime: 60_000,
  })
}

// ── SSE subscription ──────────────────────────────────────────────────────────

function useCastFsStream() {
  const queryClient = useQueryClient()

  useEvent<LiveEvent>('cast_fs_change', (e) => {
    // fsPath encodes the section as the first path segment under ~/.claude/
    // e.g. /Users/edkubiak/.claude/agents/foo.md → section: 'agents'
    if (e.fsPath) {
      const claudeRoot = '/.claude/'
      const idx = e.fsPath.indexOf(claudeRoot)
      if (idx !== -1) {
        const rel = e.fsPath.slice(idx + claudeRoot.length)
        const section = rel.split('/')[0] as SectionId
        if (section) {
          void queryClient.invalidateQueries({ queryKey: ['castFs', section] })
        }
      }
    }
  })
}

// ── section item rendering ─────────────────────────────────────────────────────

function itemLabel(section: SectionId, item: FsItem | MemoryItem | HookItem | McpItem): string {
  if (section === 'hooks') {
    const h = item as HookItem
    return `${h.event}: ${h.script.split('/').at(-1) ?? h.script}`
  }
  if (section === 'mcp') {
    return (item as McpItem).name
  }
  if (section === 'memory') {
    const m = item as MemoryItem
    return `${m.projectId}/${m.name}`
  }
  if (section === 'commands') {
    return `/${(item as FsItem).name}`
  }
  return (item as FsItem).name
}

function itemPath(section: SectionId, item: FsItem | MemoryItem | HookItem | McpItem): string {
  if (section === 'hooks' || section === 'mcp') return ''
  return (item as FsItem).path
}

// ── Section component ─────────────────────────────────────────────────────────

interface SectionProps {
  config: SectionConfig
  onPreview: (target: PreviewTarget, triggerEl?: HTMLElement) => void
  expanded: boolean
  onToggle: () => void
}

function Section({ config, onPreview, expanded, onToggle }: SectionProps) {
  const { id, label, Icon } = config
  const { data, isLoading } = useCastFs(id)
  const items = data ?? []
  const count = items.length

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`castfs-section-${id}`}
        aria-label={`${label} section`}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--system-elevated)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px] rounded-sm"
        style={{ minHeight: '36px' }}
      >
        <Icon className="w-3.5 h-3.5 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-widest text-[var(--content-muted)] flex-1 truncate select-none">
          {label}
        </span>
        {count > 0 && (
          <span
            className="text-[10px] font-mono text-[var(--content-muted)] bg-[var(--system-elevated)] rounded px-1 py-0.5 flex-shrink-0"
            aria-label={`${count} items`}
          >
            {count}
          </span>
        )}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
        }
      </button>

      {expanded && (
        <div
          id={`castfs-section-${id}`}
          role="list"
          className="pb-1"
        >
          {isLoading && (
            <div className="px-3 py-1 space-y-1" aria-label="Loading items">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-5 rounded bg-[var(--system-elevated)] animate-pulse"
                  style={{ width: `${50 + i * 12}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <p className="px-3 py-1 text-xs text-[var(--content-muted)] select-none">
              No items
            </p>
          )}
          {!isLoading && items.length > 0 && (
            <div className="max-h-[40vh] overflow-y-auto">
              {items.map((item, idx) => {
                const label = itemLabel(id, item)
                const path = itemPath(id, item)
                const isPreviewable = path.length > 0
                return (
                  <div key={idx} role="listitem">
                    <button
                      type="button"
                      aria-disabled={!isPreviewable ? 'true' : undefined}
                      tabIndex={!isPreviewable ? -1 : undefined}
                      onClick={(e) => {
                        if (isPreviewable) {
                          onPreview({ section: id, name: label, path }, e.currentTarget)
                        }
                      }}
                      onFocus={(e) => {
                        e.currentTarget.scrollIntoView({ block: 'nearest' })
                      }}
                      aria-label={`Preview ${config.label} item: ${label}`}
                      title={label}
                      className="w-full text-left px-5 py-1 text-xs transition-colors truncate focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px] rounded-sm"
                      style={{
                        minHeight: '32px', /* 32px = sidebar tree density compromise; revisit in Phase 2 a11y sweep */
                        display: 'flex',
                        alignItems: 'center',
                        color: isPreviewable ? 'var(--content-secondary)' : 'var(--content-muted)',
                        cursor: isPreviewable ? undefined : 'default',
                      }}
                    >
                      <span className={`truncate${isPreviewable ? ' hover:text-[var(--content-primary)]' : ''}`}>{label}</span>
                      {id === 'hooks' && !(item as HookItem).enabled && (
                        <span className="ml-1 text-[var(--content-muted)] flex-shrink-0">(off)</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

function readPersistedSections(): SectionId[] {
  try {
    const raw = localStorage.getItem('cast-fs-expanded-sections')
    if (raw) return JSON.parse(raw) as SectionId[]
  } catch { /* ignore */ }
  return ['agents']
}

function readPersistedRoots(): { cast: boolean; project: boolean } {
  try {
    const raw = localStorage.getItem('cast-fs-root-expanded')
    if (raw) return JSON.parse(raw) as { cast: boolean; project: boolean }
  } catch { /* ignore */ }
  return { cast: true, project: true }
}

export default function CastFsTree({ onPreview }: CastFsTreeProps) {
  const [expandedSections, setExpandedSections] = useState<SectionId[]>(readPersistedSections)
  const [rootExpanded, setRootExpanded] = useState(readPersistedRoots)

  const { data: projectRoot } = useQuery({
    queryKey: ['projectFs', '__root__'],
    queryFn: () => fetch('/api/project-fs/tree').then(r => r.json()) as Promise<{ name: string; path: string; type: string }>,
    staleTime: 60_000,
  })
  const projectName = projectRoot?.name ?? 'Project'

  useCastFsStream()

  function toggleSection(id: SectionId) {
    setExpandedSections(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
      try { localStorage.setItem('cast-fs-expanded-sections', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function toggleRoot(root: 'cast' | 'project') {
    setRootExpanded(prev => {
      const next = { ...prev, [root]: !prev[root] }
      try { localStorage.setItem('cast-fs-root-expanded', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="flex flex-col">
      {/* ── Cast root header ── */}
      <button
        type="button"
        onClick={() => toggleRoot('cast')}
        aria-expanded={rootExpanded.cast}
        aria-label="Cast section"
        className="w-full flex items-center gap-2 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px] rounded-sm"
        style={{ minHeight: '44px' }}
      >
        {rootExpanded.cast
          ? <ChevronDown className="w-3.5 h-3.5 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
          : <ChevronRight className="w-3.5 h-3.5 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
        }
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--content-primary)] flex-1 select-none">
          Cast
        </span>
      </button>

      {rootExpanded.cast && (
        <div>
          {SECTIONS.map(config => (
            <Section
              key={config.id}
              config={config}
              onPreview={onPreview}
              expanded={expandedSections.includes(config.id)}
              onToggle={() => toggleSection(config.id)}
            />
          ))}
        </div>
      )}

      {/* ── Project root header ── */}
      <button
        type="button"
        onClick={() => toggleRoot('project')}
        aria-expanded={rootExpanded.project}
        aria-label={`${projectName} section`}
        className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-left border-t border-[var(--stroke-regular)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px] rounded-sm"
        style={{ minHeight: '44px' }}
      >
        {rootExpanded.project
          ? <ChevronDown className="w-3.5 h-3.5 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
          : <ChevronRight className="w-3.5 h-3.5 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
        }
        <FolderOpen className="w-3.5 h-3.5 text-[var(--content-muted)] flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--content-primary)] flex-1 select-none truncate">
          {projectName}
        </span>
      </button>

      {rootExpanded.project && (
        <div>
          <ProjectFsTree onPreview={onPreview} />
        </div>
      )}
    </div>
  )
}
