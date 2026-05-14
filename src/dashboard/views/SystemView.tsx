import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Send, Clock,
  Play, Trash2, Plus, Check, ChevronRight, GitBranch, DollarSign, AlertTriangle
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgents } from '../api/useAgents'
import { useSystemHealth } from '../api/useSystem'
import { useRules, useSkills, useCommands } from '../api/useKnowledge'
import { useAgentMemory, useProjectMemory } from '../api/useMemory'
import { usePlans } from '../api/usePlans'
import { useChainMap, usePolicies, useModelPricing } from '../api/useCastData'
import { useCostSummary } from '../api/useCostSummary'
import { useParryGuard } from '../api/useParryGuard'
import { useAgentTruncations } from '../api/useAgentTruncations'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import PreviewModal from '../components/left-rail/PreviewModal'

// ── Tab types ──────────────────────────────────────────────────────────────

type SystemTab = 'agents' | 'rules' | 'skills' | 'memory' | 'plans' | 'cron' | 'chains' | 'policies' | 'pricing'

const SYSTEM_TABS: { key: SystemTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'agents',   label: 'Agents',    icon: Users },
  { key: 'rules',    label: 'Rules',     icon: Shield },
  { key: 'skills',   label: 'Skills',    icon: Zap },
  { key: 'memory',   label: 'Memory',    icon: Brain },
  { key: 'plans',    label: 'Plans',     icon: FileText },
  { key: 'cron',     label: 'Cron',      icon: Clock },
  { key: 'chains',   label: 'Chain Map', icon: GitBranch },
  { key: 'policies', label: 'Policies',  icon: Shield },
  { key: 'pricing',  label: 'Pricing',   icon: DollarSign },
]

// ── Agents Tab ─────────────────────────────────────────────────────────────

function AgentsTab() {
  const { data: agents, isLoading } = useAgents()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--content-muted)]">Loading agents...</div>
  if (!agents || agents.length === 0) return <div className="p-6 text-[var(--content-muted)]">No agents found.</div>

  return (
    <>
      <div className="space-y-1">
        {agents.map(agent => (
          <div key={agent.name} className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              aria-label={`Open agent definition: ${agent.name}`}
              onClick={e => {
                triggerRef.current = e.currentTarget
                setSelectedPath(agent.filePath)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--system-panel)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
            >
              <ChevronRight className="w-4 h-4 text-[var(--content-muted)] shrink-0" />
              <span className="font-medium text-sm text-[var(--content-primary)]">{agent.name}</span>
              <span className="text-xs text-[var(--content-muted)] ml-auto">{agent.model}</span>
            </button>
          </div>
        ))}
      </div>
      {selectedPath && (
        <PreviewModal
          path={selectedPath}
          source="cast"
          onClose={() => setSelectedPath(null)}
          triggerRef={triggerRef as React.RefObject<HTMLElement>}
        />
      )}
    </>
  )
}

// ── Rules Tab ──────────────────────────────────────────────────────────────

function RulesTab() {
  const { data: rules, isLoading } = useRules()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--content-muted)]">Loading rules...</div>
  if (!rules || rules.length === 0) return <div className="p-6 text-[var(--content-muted)]">No rules found.</div>

  return (
    <>
      <div className="space-y-1">
        {rules.map(rule => (
          <div key={rule.filename} className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              aria-label={`Open rule file: ${rule.filename}`}
              onClick={e => {
                triggerRef.current = e.currentTarget
                setSelectedPath(rule.path)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--system-panel)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
            >
              <ChevronRight className="w-4 h-4 text-[var(--content-muted)] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-mono text-sm text-[var(--content-primary)] block truncate">{rule.filename}</span>
                {rule.preview && (
                  <span className="text-xs text-[var(--content-secondary)] line-clamp-1">{rule.preview}</span>
                )}
              </div>
              <span className="text-xs text-[var(--content-muted)] shrink-0">{new Date(rule.modifiedAt).toLocaleDateString()}</span>
            </button>
          </div>
        ))}
      </div>
      {selectedPath && (
        <PreviewModal
          path={selectedPath}
          source="cast"
          onClose={() => setSelectedPath(null)}
          triggerRef={triggerRef as React.RefObject<HTMLElement>}
        />
      )}
    </>
  )
}

// ── Skills & Commands Tab ──────────────────────────────────────────────────

function SkillsTab() {
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--content-primary)] mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--accent)]" />
          Skills ({skills?.length ?? 0})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(skills ?? []).map(s => (
            <span
              key={s.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/20"
              title={s.description}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--content-primary)] mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--accent)]" />
          Commands ({commands?.length ?? 0})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(commands ?? []).map(c => (
            <span
              key={c.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--system-elevated)] text-[var(--content-secondary)] border border-[var(--border)] cursor-default"
            >
              /{c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Memory Tab ─────────────────────────────────────────────────────────────

const isPreviewable = (path?: string) => Boolean(path) && !path!.startsWith('cast-db:')

function MemoryTab() {
  const { data: agentMem, isLoading: loadingAgent } = useAgentMemory()
  const { data: projectMem, isLoading: loadingProject } = useProjectMemory()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  if (loadingAgent || loadingProject) return <div className="p-6 text-[var(--content-muted)]">Loading memory...</div>

  const allMemories = [
    ...(agentMem ?? []).map(m => ({ ...m, source: 'agent' as const })),
    ...(projectMem ?? []).map(m => ({ ...m, source: 'project' as const })),
  ]

  if (allMemories.length === 0) return <div className="p-6 text-[var(--content-muted)]">No memory files found in agent-memory-local/.</div>

  return (
    <>
      <div className="space-y-1">
        {allMemories.map((mem, i) => (
          <div key={i} className="border border-[var(--border)] rounded-lg overflow-hidden">
            {isPreviewable(mem.path) ? (
              <button
                aria-label={`Open memory file: ${mem.name ?? mem.filename ?? mem.agent}`}
                onClick={e => {
                  triggerRef.current = e.currentTarget
                  setSelectedPath(mem.path)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--system-panel)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
              >
                <Brain className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-sm text-[var(--content-primary)] block truncate">{mem.name ?? mem.filename ?? mem.agent}</span>
                  {mem.description && (
                    <span className="text-xs text-[var(--content-secondary)] line-clamp-1">{mem.description}</span>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--system-elevated)] text-[var(--content-muted)] shrink-0">
                  {mem.source}
                </span>
              </button>
            ) : (
              <div className="w-full flex items-center gap-3 px-4 py-3">
                <Brain className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-sm text-[var(--content-primary)] block truncate">{mem.name ?? mem.filename ?? mem.agent}</span>
                  {mem.description && (
                    <span className="text-xs text-[var(--content-secondary)] line-clamp-1">{mem.description}</span>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--system-elevated)] text-[var(--content-muted)] shrink-0">
                  {mem.source}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {selectedPath && (
        <PreviewModal
          path={selectedPath}
          source="cast"
          onClose={() => setSelectedPath(null)}
          triggerRef={triggerRef as React.RefObject<HTMLElement>}
        />
      )}
    </>
  )
}

// ── Plans Tab ──────────────────────────────────────────────────────────────

function PlansTab() {
  const { data: plans, isLoading } = usePlans()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--content-muted)]">Loading plans...</div>
  if (!plans || plans.length === 0) return <div className="p-6 text-[var(--content-muted)]">No plans found.</div>

  return (
    <>
      <div className="space-y-1">
        {plans.map(plan => (
          <div key={plan.filename} className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              aria-label={`Open plan: ${plan.title || plan.filename}`}
              onClick={e => {
                triggerRef.current = e.currentTarget
                setSelectedPath(plan.path)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--system-panel)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1"
            >
              <ChevronRight className="w-4 h-4 text-[var(--content-muted)] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-sm text-[var(--content-primary)] block truncate">{plan.title || plan.filename}</span>
                {plan.date && <span className="text-xs text-[var(--content-muted)]">{plan.date}</span>}
              </div>
            </button>
          </div>
        ))}
      </div>
      {selectedPath && (
        <PreviewModal
          path={selectedPath}
          source="cast"
          onClose={() => setSelectedPath(null)}
          triggerRef={triggerRef as React.RefObject<HTMLElement>}
        />
      )}
    </>
  )
}

// ── Cron Tab ───────────────────────────────────────────────────────────────

interface CronStatus {
  entries: string[]
  count: number
  error?: string
}

function isValidCronSchedule(schedule: string): boolean {
  return schedule.trim().split(/\s+/).length === 5
}

function extractCronCommand(line: string): string {
  const parts = line.trim().split(/\s+/)
  return parts.slice(5).join(' ')
}

function CronTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<CronStatus>({
    queryKey: ['castd', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/castd/status')
      if (!res.ok) throw new Error('Failed to fetch cron status')
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const [adding, setAdding] = useState(false)
  const [newSchedule, setNewSchedule] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ entry: string; ok: boolean; msg: string } | null>(null)

  async function addEntry() {
    if (!newSchedule.trim() || !newCommand.trim()) return
    const res = await fetch('/api/castd/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: newSchedule.trim(), command: newCommand.trim() }),
    })
    if (res.ok) {
      setNewSchedule('')
      setNewCommand('')
      setAdding(false)
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    }
  }

  async function deleteEntry(entry: string) {
    if (!window.confirm(`Delete cron entry?\n\n${entry}`)) return
    setDeleting(entry)
    try {
      await fetch('/api/castd/cron', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      })
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    } finally {
      setDeleting(null)
    }
  }

  async function triggerEntry(entry: string) {
    const command = extractCronCommand(entry)
    setTriggering(entry)
    setTriggerResult(null)
    try {
      const res = await fetch('/api/castd/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const body = await res.json() as { ok?: boolean; stdout?: string; stderr?: string; error?: string }
      setTriggerResult({
        entry,
        ok: res.ok,
        msg: res.ok ? (body.stdout?.trim() || 'Done') : (body.error ?? `HTTP ${res.status}`),
      })
    } finally {
      setTriggering(null)
    }
  }

  const scheduleValid = isValidCronSchedule(newSchedule)

  if (isLoading) return <div className="p-6 text-[var(--content-muted)]">Loading cron status...</div>

  return (
    <div className="space-y-4">
      {data?.error && <p className="text-xs text-[var(--status-error)]">{data.error}</p>}

      {data?.count === 0 && !adding && (
        <p className="text-sm text-[var(--content-muted)]">No CAST cron entries found.</p>
      )}

      {(data?.entries ?? []).length > 0 && (
        <ul className="space-y-2">
          {data!.entries.map((entry, i) => (
            <li
              key={i}
              className="flex items-start gap-2 font-mono text-xs text-[var(--content-secondary)] bg-[var(--system-elevated)] rounded-lg px-3 py-2"
            >
              <span className="flex-1 break-all">{entry}</span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => triggerEntry(entry)}
                  disabled={triggering === entry}
                  title="Run now"
                  className="p-1 rounded text-[var(--content-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
                >
                  <Play className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteEntry(entry)}
                  disabled={deleting === entry}
                  title="Delete entry"
                  className="p-1 rounded text-[var(--content-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {triggerResult && (
        <p
          className={`text-xs font-mono px-2 py-1 rounded ${triggerResult.ok ? 'text-[var(--status-success)] bg-[var(--status-success)]/10' : 'text-[var(--status-error)] bg-[var(--status-error)]/10'}`}
          role="status"
        >
          {triggerResult.ok ? 'OK' : 'FAIL'} {triggerResult.msg.slice(0, 120)}
        </p>
      )}

      {adding ? (
        <div className="space-y-2 pt-2 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <div className="space-y-1 flex-shrink-0 w-44">
              <label htmlFor="cron-schedule" className="block text-xs text-[var(--content-muted)]">Schedule (5 fields)</label>
              <input
                id="cron-schedule"
                type="text"
                value={newSchedule}
                onChange={e => setNewSchedule(e.target.value)}
                placeholder="0 * * * *"
                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--system-elevated)] border ${scheduleValid || !newSchedule ? 'border-[var(--border)]' : 'border-rose-400'} text-[var(--content-primary)] focus:outline-none focus:border-[var(--accent)]`}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <label htmlFor="cron-command" className="block text-xs text-[var(--content-muted)]">Command</label>
              <input
                id="cron-command"
                type="text"
                value={newCommand}
                onChange={e => setNewCommand(e.target.value)}
                placeholder="cast exec --sweep"
                className="w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--system-elevated)] border border-[var(--border)] text-[var(--content-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addEntry}
              disabled={!scheduleValid || !newCommand.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[#070A0F] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={() => { setAdding(false); setNewSchedule(''); setNewCommand('') }}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--content-muted)] hover:text-[var(--content-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--content-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add cron entry
        </button>
      )}
    </div>
  )
}

// ── Chain Map Tab ─────────────────────────────────────────────────────────

function ChainMapTab() {
  const { data: chainMap, isLoading } = useChainMap()

  if (isLoading) return <div className="p-6 text-[var(--content-muted)]">Loading chain map...</div>
  if (!chainMap || Object.keys(chainMap).length === 0) {
    return <div className="p-6 text-[var(--content-muted)]">No chain map found. Place chain-map.json in ~/.claude/config/.</div>
  }

  const entries = Object.entries(chainMap).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--content-muted)] mb-4">Agent dispatch chain definitions from config/chain-map.json</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-6">Agent</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider">Successors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.map(([agent, successors]) => (
              <tr key={agent} className="hover:bg-[var(--system-elevated)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--content-primary)]">{agent}</span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(successors) && successors.map((s: string) => (
                      <span
                        key={s}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/20"
                      >
                        {s}
                      </span>
                    ))}
                    {(!Array.isArray(successors) || successors.length === 0) && (
                      <span className="text-xs text-[var(--content-muted)]">--</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Policies Tab ──────────────────────────────────────────────────────────

function PoliciesTab() {
  const { data: policies, isLoading } = usePolicies()

  if (isLoading) return <div className="p-6 text-[var(--content-muted)]">Loading policies...</div>
  if (!policies || Object.keys(policies).length === 0) {
    return <div className="p-6 text-[var(--content-muted)]">No policies found. Place policies.json in ~/.claude/config/.</div>
  }

  return (
    <div>
      <p className="text-xs text-[var(--content-muted)] mb-4">Policy rules from config/policies.json</p>
      <pre className="p-4 bg-[var(--system-elevated)] rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-96 text-[var(--content-secondary)]">
        {JSON.stringify(policies, null, 2)}
      </pre>
    </div>
  )
}

// ── Pricing Tab ───────────────────────────────────────────────────────────

function fmt(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) }
  catch { return iso.slice(0, 10) }
}

function PricingTab() {
  const { data: pricing, isLoading: pricingLoading } = useModelPricing()
  const { data: cost, isLoading: costLoading, isError: costError } = useCostSummary(30)

  return (
    <div className="space-y-8">

      {/* ── Real cost activity section ───────────────────────────────── */}
      <section aria-labelledby="cost-activity-heading">
        <h3
          id="cost-activity-heading"
          className="text-sm font-semibold text-[var(--content-primary)] mb-1 flex items-center gap-2"
        >
          <DollarSign className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
          Cost Activity — last 30 days
        </h3>
        <p className="text-xs text-[var(--content-muted)] mb-4">
          Derived from JSONL session files. Same source as the token-spend page.
        </p>

        {costLoading && (
          <div className="p-6 text-[var(--content-muted)] text-sm" role="status" aria-live="polite">
            Loading cost data…
          </div>
        )}

        {costError && !costLoading && (
          <div
            className="p-4 rounded-lg bg-[var(--status-error)]/10 text-[var(--status-error)] text-sm"
            role="alert"
          >
            Failed to load cost data. Check that the server is running.
          </div>
        )}

        {!costLoading && !costError && cost && (
          <>
            {cost.totals.sessionCount === 0 ? (
              <div className="p-6 text-[var(--content-muted)] text-sm">
                No session data found for the last {cost.windowDays} days.
              </div>
            ) : (
              <div className="space-y-6">

                {/* Summary stat row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total spend', value: `$${fmt(cost.totals.costUsd, 4)}` },
                    { label: 'Sessions', value: String(cost.totals.sessionCount) },
                    { label: 'Input tokens', value: cost.totals.inputTokens.toLocaleString() },
                    { label: 'Output tokens', value: cost.totals.outputTokens.toLocaleString() },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="bg-[var(--system-elevated)] rounded-lg px-4 py-3"
                    >
                      <div className="text-xs text-[var(--content-muted)] mb-1">{stat.label}</div>
                      <div className="text-sm font-semibold text-[var(--content-primary)] tabular-nums">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Per-model breakdown */}
                {cost.byModel.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--content-secondary)] uppercase tracking-wider mb-3">
                      By model
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" aria-label="Cost breakdown by model">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-6">Model</th>
                            <th scope="col" className="text-right pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-6">Sessions</th>
                            <th scope="col" className="text-right pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider">Cost (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {cost.byModel.map(row => (
                            <tr key={row.model} className="hover:bg-[var(--system-elevated)] transition-colors">
                              <td className="py-2 pr-6">
                                <span className="text-xs font-mono text-[var(--content-primary)]">{row.model}</span>
                              </td>
                              <td className="py-2 pr-6 text-right text-[var(--content-secondary)] tabular-nums">{row.sessionCount}</td>
                              <td className="py-2 text-right text-[var(--accent)] tabular-nums">${fmt(row.costUsd, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Top sessions by cost */}
                {cost.topSessions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--content-secondary)] uppercase tracking-wider mb-3">
                      Top sessions by cost
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" aria-label="Top sessions by cost">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-4">Session</th>
                            <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-4">Project</th>
                            <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-4">Date</th>
                            <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-6">Model</th>
                            <th scope="col" className="text-right pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider">Cost (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {cost.topSessions.map(s => (
                            <tr key={s.id} className="hover:bg-[var(--system-elevated)] transition-colors">
                              <td className="py-2 pr-4">
                                <span className="text-xs font-mono text-[var(--content-muted)]" title={s.id}>
                                  {s.id.slice(0, 8)}…
                                </span>
                              </td>
                              <td className="py-2 pr-4">
                                <span className="text-xs text-[var(--content-secondary)] truncate max-w-[140px] block" title={s.project}>
                                  {s.project || '—'}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-xs text-[var(--content-muted)] tabular-nums">{fmtDate(s.startedAt)}</td>
                              <td className="py-2 pr-6">
                                <span className="text-xs font-mono text-[var(--content-secondary)]">{s.model}</span>
                              </td>
                              <td className="py-2 text-right text-[var(--accent)] tabular-nums text-xs">${fmt(s.costUsd, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Rate card section ────────────────────────────────────────── */}
      <section aria-labelledby="rate-card-heading">
        <h3
          id="rate-card-heading"
          className="text-xs font-semibold text-[var(--content-secondary)] uppercase tracking-wider mb-3"
        >
          Rate card
        </h3>
        <p className="text-xs text-[var(--content-muted)] mb-4">
          Token pricing from config/model-pricing.json ($/1M tokens)
        </p>

        {pricingLoading && (
          <div className="p-6 text-[var(--content-muted)] text-sm" role="status" aria-live="polite">
            Loading rate card…
          </div>
        )}

        {!pricingLoading && (!pricing || Object.keys(pricing).length === 0) && (
          <div className="p-4 text-[var(--content-muted)] text-sm">
            No pricing data. Place model-pricing.json in ~/.claude/config/.
          </div>
        )}

        {!pricingLoading && pricing && Object.keys(pricing).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Model rate card">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-6">Model</th>
                  <th scope="col" className="text-right pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider pr-6">Input ($/1M)</th>
                  <th scope="col" className="text-right pb-2 text-xs font-semibold text-[var(--content-muted)] uppercase tracking-wider">Output ($/1M)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Object.entries(pricing).map(([model, rates]) => {
                  const r = rates as Record<string, number> | number
                  const inputRate = typeof r === 'object' ? (r.input ?? r.input_per_1m ?? '--') : '--'
                  const outputRate = typeof r === 'object' ? (r.output ?? r.output_per_1m ?? '--') : '--'
                  return (
                    <tr key={model} className="hover:bg-[var(--system-elevated)] transition-colors">
                      <td className="py-2 pr-6">
                        <span className="text-xs font-mono text-[var(--content-primary)]">{model}</span>
                      </td>
                      <td className="py-2 pr-6 text-right text-[var(--content-secondary)] tabular-nums">${String(inputRate)}</td>
                      <td className="py-2 text-right text-[var(--accent)] tabular-nums">${String(outputRate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

// ── Dispatch Panel ─────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet 4.6' },
  { value: 'haiku',  label: 'Haiku 4.5' },
  { value: 'opus',   label: 'Opus 4.6' },
] as const

type DispatchResult =
  | { kind: 'success'; id: string }
  | { kind: 'error'; message: string }

function DispatchAgentPanel() {
  const [agentType, setAgentType] = useState('')
  const [taskText, setTaskText] = useState('')
  const [model, setModel] = useState<'sonnet' | 'haiku' | 'opus'>('sonnet')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DispatchResult | null>(null)
  const { data: agentsData, isLoading: agentsLoading } = useAgents()
  const agentNames = agentsData ? agentsData.map(a => a.name).sort() : []

  const canSubmit = agentType !== '' && taskText.trim() !== '' && !loading

  async function handleDispatch() {
    if (!canSubmit) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/control/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, prompt: taskText.trim(), model }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setResult({ kind: 'error', message: body.error ?? `HTTP ${res.status}` })
      } else {
        const body = await res.json() as { id: string }
        setResult({ kind: 'success', id: body.id })
        setTaskText('')
      }
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const selectBase =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--system-elevated,var(--system-panel))] text-[var(--content-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors'

  return (
    <div className="bg-[var(--system-panel)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-sm font-semibold">Dispatch Agent</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1.5">
          <label htmlFor="dispatch-agent" className="block text-xs font-medium text-[var(--content-secondary)]">Agent</label>
          <select id="dispatch-agent" value={agentType} onChange={e => { setAgentType(e.target.value); setResult(null) }} className={selectBase} disabled={agentsLoading}>
            {agentsLoading ? <option value="" disabled>Loading...</option> : <option value="" disabled>Select agent...</option>}
            {agentNames.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="dispatch-model" className="block text-xs font-medium text-[var(--content-secondary)]">Model</label>
          <select id="dispatch-model" value={model} onChange={e => setModel(e.target.value as typeof model)} className={selectBase}>
            {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <textarea
        value={taskText}
        onChange={e => { setTaskText(e.target.value); setResult(null) }}
        placeholder="Describe the task..."
        rows={3}
        className={`${selectBase} resize-y min-h-[80px]`}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={handleDispatch}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {loading ? 'Dispatching...' : 'Dispatch'}
        </button>
        {result?.kind === 'success' && <p className="text-xs text-[var(--status-success)]" role="status">Dispatched: {String(result.id).slice(0, 8)}</p>}
        {result?.kind === 'error' && <p className="text-xs text-[var(--status-error)]" role="alert">{result.message}</p>}
      </div>
    </div>
  )
}

// ── Health Signals Section ─────────────────────────────────────────────────

function HealthSignalsSection() {
  const { data: parryData } = useParryGuard()
  const { data: truncData } = useAgentTruncations()

  const parryEvents = (parryData?.events ?? []).slice(0, 10)
  const truncations = (truncData?.truncations ?? []).slice(0, 10)

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--content-secondary)] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        Health Signals
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parry Guard Events */}
        <div className="bento-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--content-primary)]">Parry Guard Events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--system-panel)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Rejected At</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Tool Name</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Input Snippet</th>
                </tr>
              </thead>
              <tbody>
                {parryEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[var(--content-muted)]">No parry guard events</td>
                  </tr>
                ) : parryEvents.map(ev => (
                  <tr key={ev.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--system-elevated)] transition-colors">
                    <td className="px-3 py-2 tabular-nums text-[var(--content-muted)] shrink-0">{fmtTime(ev.rejected_at)}</td>
                    <td className="px-3 py-2 text-[var(--accent)]">{ev.tool_name}</td>
                    <td className="px-3 py-2 text-[var(--content-muted)] truncate max-w-[200px]" title={ev.input_snippet ?? undefined} colSpan={2}>{ev.input_snippet ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Truncations */}
        <div className="bento-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--content-primary)]">Agent Truncations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--system-panel)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Time</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Agent Type</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Chars</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--content-muted)]">Last Line</th>
                </tr>
              </thead>
              <tbody>
                {truncations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[var(--content-muted)]">No agent truncations</td>
                  </tr>
                ) : truncations.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--system-elevated)] transition-colors">
                    <td className="px-3 py-2 tabular-nums text-[var(--content-muted)]">{fmtTime(t.timestamp)}</td>
                    <td className="px-3 py-2 text-[var(--content-primary)]">{t.agent_type}</td>
                    <td className="px-3 py-2 text-[var(--content-secondary)]">{t.char_count ?? '—'}</td>
                    <td className="px-3 py-2 text-[var(--content-muted)] truncate max-w-[140px]" title={t.last_line ?? undefined}>{t.last_line ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main SystemView ────────────────────────────────────────────────────────

export default function SystemView() {
  const [activeTab, setActiveTab] = useState<SystemTab>('agents')
  const { data: health, isLoading } = useSystemHealth()

  const statCards = health
    ? [
        { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" /> },
        { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" /> },
        { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" /> },
        { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" />, to: '/sessions' },
      ]
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">System</h1>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(stat => <StatCard key={stat.label} {...stat} />)}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto">
        {SYSTEM_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--content-secondary)] hover:text-[var(--content-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'cron' && <CronTab />}
        {activeTab === 'chains' && <ChainMapTab />}
        {activeTab === 'policies' && <PoliciesTab />}
        {activeTab === 'pricing' && <PricingTab />}
      </div>

      {/* Health Signals — parry guard + agent truncations */}
      <HealthSignalsSection />

      {/* Dispatch Agent panel — always visible at bottom */}
      <div className="mt-8">
        <DispatchAgentPanel />
      </div>
    </div>
  )
}
