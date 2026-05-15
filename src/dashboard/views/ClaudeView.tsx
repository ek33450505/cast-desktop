import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Bot,
  Layers,
  BookOpen,
  ClipboardList,
  Terminal,
  Brain,
  Zap,
  Plug,
  Microscope,
  FileText,
  BarChart2,
  Code2,
  Folder,
} from 'lucide-react'
import type { ComponentType } from 'react'
import {
  useCastFsAgents,
  useCastFsSkills,
  useCastFsRules,
  useCastFsPlans,
  useCastFsCommands,
  useCastFsMemory,
  useCastFsHooks,
  useCastFsMcp,
  useCastFsResearch,
  useCastFsBriefings,
  useCastFsReports,
  useCastFsScripts,
  useCastFsSseInvalidation,
} from '../api/useCastFs'
import type { SectionKey, FsItem, MemoryItem, HookItem, McpItem } from '../api/useCastFs'
import PreviewModal from '../components/left-rail/PreviewModal'
import { timeAgoFromMs } from '../utils/time'

// ── Section config ─────────────────────────────────────────────────────────────

interface SectionDef {
  key: SectionKey
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

const SECTIONS: SectionDef[] = [
  { key: 'agents',    label: 'Agents',    icon: Bot },
  { key: 'skills',    label: 'Skills',    icon: Layers },
  { key: 'rules',     label: 'Rules',     icon: BookOpen },
  { key: 'plans',     label: 'Plans',     icon: ClipboardList },
  { key: 'commands',  label: 'Commands',  icon: Terminal },
  { key: 'memory',    label: 'Memory',    icon: Brain },
  { key: 'hooks',     label: 'Hooks',     icon: Zap },
  { key: 'mcp',       label: 'MCP',       icon: Plug },
  { key: 'research',  label: 'Research',  icon: Microscope },
  { key: 'briefings', label: 'Briefings', icon: FileText },
  { key: 'reports',   label: 'Reports',   icon: BarChart2 },
  { key: 'scripts',   label: 'Scripts',   icon: Code2 },
]

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-1 px-3 py-2" aria-busy="true" aria-label="Loading files">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-8 rounded-md animate-pulse bg-[var(--system-elevated)]" aria-hidden="true" />
      ))}
    </div>
  )
}

// ── File row button ────────────────────────────────────────────────────────────

interface FileRowProps {
  item: FsItem
  onClick: (item: FsItem, ref: React.RefObject<HTMLButtonElement | null>) => void
}

function FileRow({ item, onClick }: FileRowProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => onClick(item, btnRef)}
      aria-label={`Open ${item.name}`}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-md hover:bg-[var(--system-elevated)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 group"
    >
      <span className="text-xs font-medium text-[var(--content-primary)] truncate">
        {item.name}
      </span>
      <span className="text-[10px] text-[var(--content-muted)] shrink-0 tabular-nums">
        {timeAgoFromMs(item.mtime)}
      </span>
    </button>
  )
}

// ── Hooks info card ────────────────────────────────────────────────────────────

function HookCard({ item }: { item: HookItem }) {
  return (
    <div className="bento-card px-3 py-2 text-xs space-y-1">
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-[var(--content-muted)] font-medium">Event</dt>
        <dd className="text-[var(--content-primary)] font-mono truncate">{item.event}</dd>
        <dt className="text-[var(--content-muted)] font-medium">Script</dt>
        <dd className="text-[var(--content-secondary)] truncate">{item.script}</dd>
        <dt className="text-[var(--content-muted)] font-medium">Enabled</dt>
        <dd className={item.enabled ? 'text-emerald-400' : 'text-[var(--content-muted)]'}>
          {item.enabled ? 'Yes' : 'No'}
        </dd>
      </dl>
    </div>
  )
}

// ── MCP info card ──────────────────────────────────────────────────────────────

function McpCard({ item }: { item: McpItem }) {
  return (
    <div className="bento-card px-3 py-2 text-xs space-y-1">
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-[var(--content-muted)] font-medium">Name</dt>
        <dd className="text-[var(--content-primary)] font-medium">{item.name}</dd>
        <dt className="text-[var(--content-muted)] font-medium">Command</dt>
        <dd className="text-[var(--content-secondary)] font-mono truncate">{item.command}</dd>
        {item.args.length > 0 && (
          <>
            <dt className="text-[var(--content-muted)] font-medium">Args</dt>
            <dd className="text-[var(--content-secondary)] font-mono truncate">{item.args.join(' ')}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

// ── Memory grouped view ────────────────────────────────────────────────────────

interface MemoryGroupsProps {
  items: MemoryItem[]
  query: string
  onOpen: (item: FsItem, ref: React.RefObject<HTMLButtonElement | null>) => void
}

function MemoryGroups({ items, query, onOpen }: MemoryGroupsProps) {
  const filtered = query
    ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : items

  // Group by projectId
  const groups = filtered.reduce<Record<string, MemoryItem[]>>((acc, item) => {
    const key = item.projectId || '(global)'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  if (Object.keys(groups).length === 0) {
    return (
      <p className="px-3 py-6 text-xs text-[var(--content-muted)] text-center">No files found</p>
    )
  }

  return (
    <div className="space-y-2 px-1">
      {Object.entries(groups).map(([projectId, groupItems]) => (
        <details key={projectId} open>
          <summary className="list-none flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-[var(--content-secondary)] cursor-pointer select-none hover:text-[var(--content-primary)] transition-colors rounded-md hover:bg-[var(--system-elevated)]">
            <span className="truncate">{projectId}</span>
            <span className="ml-auto text-[10px] text-[var(--content-muted)] shrink-0">{groupItems.length}</span>
          </summary>
          <div className="pl-2">
            {groupItems.map(item => (
              <FileRow key={item.path} item={item} onClick={onOpen} />
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

// ── Right panel content ────────────────────────────────────────────────────────

interface SectionContentProps {
  section: SectionKey
  query: string
  onOpen: (item: FsItem, ref: React.RefObject<HTMLButtonElement | null>) => void
}

function SectionContent({ section, query, onOpen }: SectionContentProps) {
  const agentsQ    = useCastFsAgents()
  const skillsQ    = useCastFsSkills()
  const rulesQ     = useCastFsRules()
  const plansQ     = useCastFsPlans()
  const commandsQ  = useCastFsCommands()
  const memoryQ    = useCastFsMemory()
  const hooksQ     = useCastFsHooks()
  const mcpQ       = useCastFsMcp()
  const researchQ  = useCastFsResearch()
  const briefingsQ = useCastFsBriefings()
  const reportsQ   = useCastFsReports()
  const scriptsQ   = useCastFsScripts()

  // Select the active query
  const queryMap: Record<SectionKey, { data: unknown[] | undefined; isLoading: boolean }> = {
    agents:    agentsQ,
    skills:    skillsQ,
    rules:     rulesQ,
    plans:     plansQ,
    commands:  commandsQ,
    memory:    memoryQ,
    hooks:     hooksQ,
    mcp:       mcpQ,
    research:  researchQ,
    briefings: briefingsQ,
    reports:   reportsQ,
    scripts:   scriptsQ,
  }

  const { data, isLoading } = queryMap[section]

  if (isLoading) return <SkeletonRows />

  // Hooks: structured info cards
  if (section === 'hooks') {
    const items = (data ?? []) as HookItem[]
    if (items.length === 0) {
      return <p className="px-3 py-6 text-xs text-[var(--content-muted)] text-center">No hooks configured</p>
    }
    const filtered = query
      ? items.filter(i => i.event.toLowerCase().includes(query.toLowerCase()) || i.script.toLowerCase().includes(query.toLowerCase()))
      : items
    return (
      <div className="space-y-2 p-2">
        {filtered.map((item, i) => <HookCard key={i} item={item} />)}
        {filtered.length === 0 && <p className="px-3 py-4 text-xs text-[var(--content-muted)] text-center">No hooks match filter</p>}
      </div>
    )
  }

  // MCP: structured info cards
  if (section === 'mcp') {
    const items = (data ?? []) as McpItem[]
    if (items.length === 0) {
      return <p className="px-3 py-6 text-xs text-[var(--content-muted)] text-center">No MCP servers configured</p>
    }
    const filtered = query
      ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()) || i.command.toLowerCase().includes(query.toLowerCase()))
      : items
    return (
      <div className="space-y-2 p-2">
        {filtered.map((item, i) => <McpCard key={i} item={item} />)}
        {filtered.length === 0 && <p className="px-3 py-4 text-xs text-[var(--content-muted)] text-center">No servers match filter</p>}
      </div>
    )
  }

  // Memory: grouped by projectId
  if (section === 'memory') {
    return (
      <MemoryGroups
        items={(data ?? []) as MemoryItem[]}
        query={query}
        onOpen={onOpen}
      />
    )
  }

  // Default: file list
  const items = (data ?? []) as FsItem[]
  const filtered = query
    ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : items

  if (filtered.length === 0) {
    return (
      <p className="px-3 py-6 text-xs text-[var(--content-muted)] text-center">
        {items.length === 0 ? 'No files found' : 'No files match filter'}
      </p>
    )
  }

  return (
    <div className="space-y-0.5 px-1">
      {filtered.map(item => (
        <FileRow key={item.path} item={item} onClick={onOpen} />
      ))}
    </div>
  )
}

// ── ClaudeView ─────────────────────────────────────────────────────────────────

export default function ClaudeView() {
  // Wire SSE invalidation once at the top level
  useCastFsSseInvalidation()

  const shouldReduceMotion = useReducedMotion()
  const [activeSection, setActiveSection] = useState<SectionKey>('agents')
  const [query, setQuery] = useState('')
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewTrigger, setPreviewTrigger] = useState<React.RefObject<HTMLButtonElement | null> | null>(null)

  function handleOpen(item: FsItem, ref: React.RefObject<HTMLButtonElement | null>) {
    setPreviewPath(item.path)
    setPreviewTrigger(ref)
  }

  function handleSectionChange(key: SectionKey) {
    setActiveSection(key)
    setQuery('')
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="flex h-full overflow-hidden"
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="flex-none flex flex-col overflow-y-auto"
        style={{
          width: '220px',
          borderRight: '1px solid var(--stroke-regular)',
          background: 'var(--system-panel)',
        }}
        aria-label="~/.claude/ sections"
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--stroke-regular)]">
          <Folder className="w-4 h-4 text-[var(--accent)] shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-[var(--content-secondary)] font-mono">~/.claude/</span>
        </div>

        {/* Section list */}
        <nav className="flex-1 py-1" aria-label="File sections">
          {SECTIONS.map(({ key, label, icon: Icon }) => {
            const isActive = activeSection === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSectionChange(key)}
                aria-label={`View ${label} section`}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]
                  ${isActive
                    ? 'text-[var(--accent)] bg-[var(--accent-muted)]'
                    : 'text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--system-elevated)]'
                  }
                `}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="flex-none px-3 py-2 border-b border-[var(--stroke-regular)]"
             style={{ background: 'var(--system-canvas)' }}>
          <label htmlFor="claude-search" className="sr-only">Filter files</label>
          <input
            id="claude-search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--system-panel)] border border-[var(--border)] text-[var(--content-primary)] placeholder:text-[var(--content-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto py-1" style={{ background: 'var(--system-canvas)' }}>
          <SectionContent section={activeSection} query={query} onOpen={handleOpen} />
        </div>
      </div>

      {/* ── Preview modal ────────────────────────────────────────────────────── */}
      {previewPath && (
        <PreviewModal
          path={previewPath}
          source="cast"
          onClose={() => setPreviewPath(null)}
          triggerRef={previewTrigger ?? undefined}
        />
      )}
    </motion.div>
  )
}
