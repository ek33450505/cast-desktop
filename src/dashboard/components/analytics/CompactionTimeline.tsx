import { Minimize2 } from 'lucide-react'
import { useCompactionEvents } from '../../api/useCastData'
import Skeleton from '../Skeleton'

export default function CompactionTimeline() {
  const { data: events, isLoading } = useCompactionEvents()

  if (isLoading) {
    return (
      <div className="bento-card p-6">
        <Skeleton width="10rem" height="1.5rem" className="mb-4" />
        <Skeleton height="8rem" />
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Minimize2 className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--content-primary)]">Compaction Timeline</h2>
        </div>
        <p className="text-sm text-[var(--content-muted)] py-8 text-center">No compaction events recorded</p>
      </div>
    )
  }

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Minimize2 className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--content-primary)]">Compaction Timeline</h2>
        <span className="text-xs text-[var(--content-muted)] ml-auto tabular-nums">{events.length} events</span>
      </div>

      <div className="space-y-1.5">
        {events.slice(0, 15).map(event => (
          <div key={event.id} className="flex items-center gap-3 text-xs bg-[var(--system-elevated)] rounded px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
            <span className="text-[var(--content-muted)] shrink-0 w-28 truncate">
              {new Date(event.timestamp).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span className="font-mono text-[var(--content-primary)] shrink-0">
              {event.trigger}
            </span>
            {event.compaction_tier && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--accent-muted)] text-[var(--accent)] text-[10px]">
                tier {event.compaction_tier}
              </span>
            )}
            <span className="text-[var(--content-muted)] truncate flex-1 text-right">
              {event.session_id?.slice(0, 8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
