import { useState } from 'react'
import { Network, MessageSquare, BarChart2, Users } from 'lucide-react'
import { useSwarmSessions, useSwarmDetail, useSwarmMessages } from '../api/useSwarm'
import { SwarmCard } from '../components/SwarmView/SwarmCard'
import { TeammateRow } from '../components/SwarmView/TeammateRow'
import { MessageFeed } from '../components/SwarmView/MessageFeed'
import { TokenChart } from '../components/SwarmView/TokenChart'
import { PageSkeleton } from '../components/ui/PageSkeleton'
import { EmptyState } from '../components/ui/EmptyState'
import type { SwarmSession } from '../types'

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-[var(--content-primary)]">{label}</h2>
      {count !== undefined && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--system-elevated)] text-[var(--content-muted)]">
          {count}
        </span>
      )}
    </div>
  )
}

// ── Swarm Detail Panel ────────────────────────────────────────────────────────

function SwarmDetailPanel({ swarmId }: { swarmId: string }) {
  const { data: detail, isLoading: detailLoading } = useSwarmDetail(swarmId)
  const { data: messages = [], isLoading: messagesLoading } = useSwarmMessages(swarmId)
  const [tab, setTab] = useState<'teammates' | 'messages' | 'tokens'>('teammates')

  if (detailLoading) {
    return (
      <div className="bento-card p-6 flex items-center justify-center">
        <span className="text-xs text-[var(--content-muted)] animate-pulse">Loading swarm details…</span>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="bento-card p-6 flex items-center justify-center">
        <span className="text-xs text-[var(--content-muted)]">Swarm not found</span>
      </div>
    )
  }

  const { session, teammates } = detail

  return (
    <div className="bento-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--content-primary)]">{session.team_name}</span>
        </div>
        {session.notes && (
          <p className="text-xs text-[var(--content-muted)] mt-1">{session.notes}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {([ 'teammates', 'messages', 'tokens' ] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px'
                : 'text-[var(--content-muted)] hover:text-[var(--content-secondary)]'
            }`}
          >
            {t === 'teammates' && <Users className="w-3.5 h-3.5" />}
            {t === 'messages'  && <MessageSquare className="w-3.5 h-3.5" />}
            {t === 'tokens'    && <BarChart2 className="w-3.5 h-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="overflow-hidden">
        {tab === 'teammates' && (
          <div>
            {teammates.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--content-muted)]">
                No teammate runs recorded yet
              </div>
            ) : (
              teammates.map(t => <TeammateRow key={t.id} teammate={t} />)
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="p-4">
            {messagesLoading ? (
              <div className="text-xs text-[var(--content-muted)] animate-pulse">Loading messages…</div>
            ) : (
              <MessageFeed messages={messages} />
            )}
          </div>
        )}

        {tab === 'tokens' && (
          <div className="p-4">
            <TokenChart teammates={teammates} />
          </div>
        )}
      </div>
    </div>
  )
}


// ── Main view ─────────────────────────────────────────────────────────────────

export default function SwarmView() {
  const { data: sessions = [], isLoading, isError } = useSwarmSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const active = sessions.filter((s: SwarmSession) => s.status === 'running')
  const past   = sessions.filter((s: SwarmSession) => s.status !== 'running')

  function handleSelect(id: string) {
    setSelectedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="p-6 space-y-8 min-h-full">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Network className="w-6 h-6 text-[var(--accent)]" />
        <div>
          <h1 className="text-xl font-bold text-[var(--content-primary)]">Swarm</h1>
          <p className="text-xs text-[var(--content-muted)]">CAST Agent Team sessions</p>
        </div>
      </div>

      {isError && (
        <div className="bento-card p-6 border-rose-500/30 bg-rose-500/10">
          <p className="text-xs text-rose-400">Failed to load swarm sessions. Is the server running?</p>
        </div>
      )}

      {isLoading && <PageSkeleton variant="grid" cols={2} rows={1} />}

      {!isLoading && (
        <>
          {/* Active Swarms */}
          <section>
            <SectionHeader label="Active Swarms" count={active.length} />
            {active.length === 0 ? (
              <p className="text-xs text-[var(--content-muted)]">No active swarms</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((s: SwarmSession) => (
                  <SwarmCard
                    key={s.id}
                    session={s}
                    isSelected={selectedId === s.id}
                    onClick={() => handleSelect(s.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Detail panel for selected swarm */}
          {selectedId && (
            <section>
              <SwarmDetailPanel swarmId={selectedId} />
            </section>
          )}

          {/* Past Swarms */}
          <section>
            <SectionHeader label="Past Swarms" count={past.length} />
            {past.length === 0 && active.length === 0 ? (
              <EmptyState
                icon={Network}
                title="No swarms yet"
                message={`Start a swarm with /swarm <team> "<task>" in Claude Code.`}
                className="col-span-full"
              />
            ) : past.length === 0 ? (
              <p className="text-xs text-[var(--content-muted)]">No past swarms</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((s: SwarmSession) => (
                  <SwarmCard
                    key={s.id}
                    session={s}
                    isSelected={selectedId === s.id}
                    onClick={() => handleSelect(s.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
