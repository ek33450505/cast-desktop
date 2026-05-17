import { Webhook } from 'lucide-react'
import { useHooks } from '../api/useHooks'
import type { HookDefinition } from '../api/useHooks'

function groupByEvent(hooks: HookDefinition[]): Map<string, HookDefinition[]> {
  const map = new Map<string, HookDefinition[]>()
  for (const hook of hooks) {
    if (!map.has(hook.event)) map.set(hook.event, [])
    map.get(hook.event)!.push(hook)
  }
  return map
}

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-label="Loading hooks">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-12 rounded animate-pulse"
          style={{ background: 'var(--system-elevated)', width: `${90 - i * 5}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

export default function HooksPage() {
  const { data: hooks = [], isLoading, error } = useHooks()
  const grouped = groupByEvent(hooks)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Webhook className="w-5 h-5" aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Hooks</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--content-muted)' }}>
            Claude Code event hooks registered in ~/.claude/settings.json
          </p>
        </div>
      </div>

      {isLoading && <SkeletonRows />}

      {error && (
        <div className="rounded-xl p-4 text-sm" role="alert" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)', color: 'var(--content-muted)' }}>
          Failed to load hooks.
        </div>
      )}

      {!isLoading && !error && hooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Webhook className="w-10 h-10 opacity-20" aria-hidden="true" style={{ color: 'var(--content-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--content-muted)' }}>No hooks configured</p>
        </div>
      )}

      {!isLoading && !error && hooks.length > 0 && (
        <div className="space-y-6">
          {[...grouped.entries()].map(([event, eventHooks]) => (
            <section key={event} aria-label={`${event} hooks`}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--content-secondary)' }}>
                  {event}
                </h2>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--system-elevated)', color: 'var(--content-muted)' }}
                >
                  {eventHooks.length}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
                {eventHooks.map((hook, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3"
                    style={{ borderBottom: i < eventHooks.length - 1 ? '1px solid var(--border)' : 'none', minHeight: '44px' }}
                  >
                    <span
                      className="shrink-0 text-xs px-2 py-0.5 rounded font-mono font-medium mt-0.5"
                      style={{
                        background: hook.type === 'hookify' ? 'var(--system-elevated)' : 'var(--system-elevated)',
                        color: hook.type === 'hookify' ? 'var(--accent)' : 'var(--content-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {hook.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm truncate"
                        style={{ color: 'var(--content-primary)' }}
                        title={hook.command ?? hook.description ?? ''}
                      >
                        {hook.command ?? hook.description ?? '—'}
                      </p>
                      {hook.matcher && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--content-muted)' }}>
                          matcher: {hook.matcher}
                        </p>
                      )}
                    </div>
                    {hook.timeout && (
                      <span className="shrink-0 text-xs" style={{ color: 'var(--content-muted)' }}>
                        {hook.timeout}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
