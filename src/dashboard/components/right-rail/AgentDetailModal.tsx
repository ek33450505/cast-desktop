import { useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentRunDetail {
  agentRunId: string
  name: string
  model: string
  prompt: string | null
  startedAt: string
  endedAt: string | null
  status: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchAgentRunDetail(agentRunId: string): Promise<AgentRunDetail> {
  const res = await fetch(`/api/agents/runs/${encodeURIComponent(agentRunId)}`)
  if (!res.ok) throw new Error(`Failed to fetch agent run: HTTP ${res.status}`)
  return res.json() as Promise<AgentRunDetail>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function modelTierLabel(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'haiku'
  if (lower.includes('opus')) return 'opus'
  return 'sonnet'
}

function modelBadgeVar(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'var(--cast-badge-haiku)'
  if (lower.includes('opus')) return 'var(--cast-badge-opus)'
  return 'var(--cast-badge-sonnet)'
}

// ── Focusable element query ───────────────────────────────────────────────────

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// ── AgentDetailModal ──────────────────────────────────────────────────────────

interface AgentDetailModalProps {
  open: boolean
  agentRunId: string
  onClose: () => void
}

export default function AgentDetailModal({ open, agentRunId, onClose }: AgentDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const titleId = `agent-detail-title-${agentRunId}`

  const { data, isLoading, error } = useQuery<AgentRunDetail>({
    queryKey: ['agent-run-detail', agentRunId],
    queryFn: () => fetchAgentRunDetail(agentRunId),
    enabled: open,
    staleTime: 30_000,
  })

  // Save trigger element on open; restore focus on close.
  // Only capture triggerRef when it's null so rapid-fire opens don't overwrite the
  // original trigger before the prior close restores focus to it.
  useEffect(() => {
    if (open) {
      if (!triggerRef.current) {
        triggerRef.current = document.activeElement
      }
      requestAnimationFrame(() => {
        const el = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
        el?.focus()
      })
    } else {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
      triggerRef.current = null
    }
  }, [open])

  // Trap focus inside modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  if (!open) return null

  const tier = data ? modelTierLabel(data.model) : null
  const badgeColor = data ? modelBadgeVar(data.model) : null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--cast-overlay-backdrop)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-hidden="false"
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex flex-col rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--cast-rail-border)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 gap-3"
          style={{ borderBottom: '1px solid var(--cast-rail-border)' }}
        >
          <h2
            id={titleId}
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {isLoading ? 'Loading…' : (data?.name ?? 'Agent Run')}
          </h2>

          {tier && badgeColor && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                background: `${badgeColor}22`,
                color: badgeColor,
                border: `1px solid ${badgeColor}44`,
              }}
              aria-label={`Model: ${tier}`}
            >
              {tier}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close agent detail"
            className="ml-auto shrink-0 rounded-md flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-1"
            style={{
              width: '28px',
              height: '28px',
              color: 'var(--text-muted)',
              background: 'transparent',
            }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isLoading && (
            <div className="flex flex-col gap-2" aria-label="Loading agent run detail">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-4 rounded animate-pulse"
                  style={{ background: 'var(--bg-tertiary)', opacity: 0.6 }}
                />
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: 'var(--error)' }}>
              Failed to load agent run details.
            </p>
          )}

          {data && (
            <>
              {/* Prompt */}
              {data.prompt && (
                <div>
                  <p
                    className="text-[10px] uppercase tracking-wider font-medium mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Prompt
                  </p>
                  <p
                    className="text-xs leading-relaxed select-text break-words whitespace-pre-wrap"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {data.prompt}
                  </p>
                </div>
              )}

              {/* Metadata grid */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Status
                  </dt>
                  <dd style={{ color: 'var(--text-primary)' }}>{data.status}</dd>
                </div>

                <div>
                  <dt className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Started
                  </dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>{formatDateTime(data.startedAt)}</dd>
                </div>

                {data.endedAt && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      Ended
                    </dt>
                    <dd style={{ color: 'var(--text-secondary)' }}>{formatDateTime(data.endedAt)}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Input tokens
                  </dt>
                  <dd style={{ color: 'var(--text-primary)' }}>{data.inputTokens.toLocaleString()}</dd>
                </div>

                <div>
                  <dt className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Output tokens
                  </dt>
                  <dd style={{ color: 'var(--text-primary)' }}>{data.outputTokens.toLocaleString()}</dd>
                </div>

                {data.costUsd > 0 && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      Cost
                    </dt>
                    <dd style={{ color: 'var(--text-primary)' }}>
                      ${data.costUsd.toFixed(4)}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
