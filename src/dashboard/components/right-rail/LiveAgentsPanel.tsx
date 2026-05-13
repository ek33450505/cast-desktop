import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEvent } from '../../../lib/SseManager'
import type { LiveEvent } from '../../../types'
import { Bot } from 'lucide-react'
import { usePaneBinding } from '../../../hooks/usePaneBinding'
import { useTerminalStore } from '../../../stores/terminalStore'
import AgentDetailModal from './AgentDetailModal'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunningAgent {
  agentRunId: string
  name: string
  model: string
  prompt: string
  startedAt: string
  tokenCount: number
}

interface RunningAgentsResponse {
  agents: RunningAgent[]
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchRunningAgents(sessionId: string | null): Promise<RunningAgentsResponse> {
  if (!sessionId) return { agents: [] }
  const res = await fetch(`/api/agents/running?sessionId=${encodeURIComponent(sessionId)}`)
  if (!res.ok) throw new Error(`Failed to fetch running agents: HTTP ${res.status}`)
  return res.json() as Promise<RunningAgentsResponse>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(startedAt: string, nowMs: number): string {
  const startMs = new Date(startedAt).getTime()
  const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  const h = Math.floor(diffSec / 3600)
  const m = Math.floor((diffSec % 3600) / 60)
  const s = diffSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function modelBadgeVar(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'var(--model-haiku)'
  if (lower.includes('opus')) return 'var(--model-opus)'
  return 'var(--model-sonnet)' // default to sonnet tier
}

function modelTierLabel(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'haiku'
  if (lower.includes('opus')) return 'opus'
  return 'sonnet'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center py-6 px-3"
      aria-label="No active agents"
    >
      <Bot
        className="w-6 h-6"
        style={{ color: 'var(--content-muted)' }}
        aria-hidden="true"
      />
      <p className="text-xs" style={{ color: 'var(--content-muted)' }}>
        No active agents
      </p>
    </div>
  )
}

interface AgentRowProps {
  agent: RunningAgent
  nowMs: number
  onClick: (agentRunId: string) => void
}

function AgentRow({ agent, nowMs, onClick }: AgentRowProps) {
  const tier = modelTierLabel(agent.model)
  const badgeColor = modelBadgeVar(agent.model)

  return (
    <tr
      role="row"
      className="cursor-pointer rounded transition-colors"
      style={{ background: 'transparent' }}
      onClick={() => onClick(agent.agentRunId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(agent.agentRunId)
        }
      }}
      tabIndex={0}
      aria-label={`Agent ${agent.name}, ${tier} model, running for ${formatElapsed(agent.startedAt, nowMs)}`}
    >
      {/* Agent name */}
      <td className="py-1.5 pr-2 align-top">
        <span
          className="text-xs font-semibold truncate block max-w-[80px]"
          style={{ color: 'var(--content-primary)' }}
          title={agent.name}
        >
          {agent.name}
        </span>
      </td>

      {/* Model badge */}
      <td className="py-1.5 pr-2 align-top">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{
            background: `${badgeColor}22`,
            color: badgeColor,
            border: `1px solid ${badgeColor}44`,
          }}
          aria-label={`Model: ${tier}`}
        >
          {tier}
        </span>
      </td>

      {/* Elapsed timer */}
      <td className="py-1.5 pr-2 align-top">
        <span
          className="text-[10px] font-mono"
          style={{ color: 'var(--content-muted)' }}
          aria-live="off"
        >
          {formatElapsed(agent.startedAt, nowMs)}
        </span>
      </td>

      {/* Prompt snippet */}
      <td className="py-1.5 align-top">
        <span
          className="text-[10px] truncate block max-w-[90px]"
          style={{ color: 'var(--content-secondary)' }}
          title={agent.prompt}
        >
          {agent.prompt || '—'}
        </span>
      </td>
    </tr>
  )
}

// ── LiveAgentsPanel ───────────────────────────────────────────────────────────

export default function LiveAgentsPanel() {
  const queryClient = useQueryClient()

  // Mirror PlanProgressPanel store-read pattern exactly
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activePaneId = activeTab?.paneId ?? undefined

  const { sessionId } = usePaneBinding(activePaneId)

  // Live clock — single shared interval ticking every second
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Fetch running agents
  const { data, isLoading } = useQuery<RunningAgentsResponse>({
    queryKey: ['running-agents', sessionId],
    queryFn: () => fetchRunningAgents(sessionId),
    staleTime: 5_000,
  })

  // SSE subscription — invalidate query on agents-update
  useEvent<LiveEvent>('db_change_agent_run', () => {
    void queryClient.invalidateQueries({ queryKey: ['running-agents', sessionId] })
  })

  // Single shared timer — avoids one interval per agent row
  useEffect(() => {
    const agents = data?.agents ?? []
    if (agents.length === 0) return

    const id = setInterval(() => setNowMs(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [data?.agents])

  // Modal state
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleRowClick = useCallback((agentRunId: string) => {
    setSelectedRunId(agentRunId)
    setModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setModalOpen(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2" aria-label="Loading agents">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-4 rounded animate-pulse"
            style={{ background: 'var(--system-elevated)', opacity: 0.6 }}
          />
        ))}
      </div>
    )
  }

  const agents = data?.agents ?? []

  return (
    <>
      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <table
          role="table"
          aria-label="Running agents"
          className="w-full text-xs border-collapse"
          style={{ tableLayout: 'auto' }}
        >
          <tbody>
            {agents.map((agent) => (
              <AgentRow
                key={agent.agentRunId}
                agent={agent}
                nowMs={nowMs}
                onClick={handleRowClick}
              />
            ))}
          </tbody>
        </table>
      )}

      {selectedRunId && (
        <AgentDetailModal
          open={modalOpen}
          agentRunId={selectedRunId}
          onClose={handleModalClose}
        />
      )}
    </>
  )
}
