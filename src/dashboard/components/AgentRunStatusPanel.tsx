/**
 * AgentRunStatusPanel — IDE-5: Fixed-position status panel shown after agent dispatch.
 *
 * Polls GET /api/dispatch/:run_id every 2s.
 * - running: shows "Running: <agent> (<run_id_short>) [Cancel]"
 * - done: success toast, closes panel
 * - failed: error toast, closes panel
 *
 * a11y:
 * - role="status" + aria-live="polite" (non-intrusive live region)
 * - Cancel button has aria-label
 * - All interactive elements have visible focus rings
 */

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import type { DispatchAgent } from './DispatchModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentRunStatusPanelProps {
  run_id: string
  agent: DispatchAgent
  onClose: () => void
}

// ── AgentRunStatusPanel ────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000

export function AgentRunStatusPanel({ run_id, agent, onClose }: AgentRunStatusPanelProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closedRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleClose = useCallback(() => {
    closedRef.current = true
    stopPolling()
    onClose()
  }, [stopPolling, onClose])

  const handleCancel = useCallback(async () => {
    // Best-effort: send DELETE; if server doesn't support it or errors, just close
    try {
      await fetch(`/api/dispatch/${run_id}`, { method: 'DELETE' })
    } catch {
      // Ignore — just close the panel
    }
    handleClose()
  }, [run_id, handleClose])

  useEffect(() => {
    let unmounted = false

    const poll = async () => {
      if (closedRef.current || unmounted) return
      try {
        const res = await fetch(`/api/dispatch/${run_id}`)
        if (!res.ok) {
          // Non-2xx: treat as transient error, keep polling
          return
        }
        const body = await res.json() as {
          run_id: string
          status: 'running' | 'done' | 'failed'
          files_modified?: string[]
          error?: string
        }

        if (unmounted || closedRef.current) return

        if (body.status === 'done') {
          const fileCount = body.files_modified?.length ?? 0
          const filesMsg = fileCount === 1
            ? '1 file updated'
            : fileCount > 1
            ? `${fileCount} files updated`
            : 'no files reported'
          toast.success(`Agent finished — ${filesMsg}`)
          handleClose()
        } else if (body.status === 'failed') {
          const errorMsg = body.error ?? 'Agent run failed'
          toast.error(`Agent failed: ${errorMsg}`)
          handleClose()
        }
        // 'running' — continue polling
      } catch {
        // Network error: keep polling (agent may still be running)
      }
    }

    // Poll immediately, then on interval
    void poll()
    intervalRef.current = setInterval(() => { void poll() }, POLL_INTERVAL_MS)

    return () => {
      unmounted = true
      stopPolling()
    }
  }, [run_id, handleClose, stopPolling])

  // Short display ID — first 8 chars after the prefix
  const shortId = run_id.split('-').slice(-2).join('-').slice(0, 8)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Agent run status: ${agent} running`}
      data-testid="agent-run-status-panel"
      style={{
        position: 'fixed',
        bottom: 56, // above bottom dock
        right: 16,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: 'var(--cast-center-bg)',
        border: '1px solid var(--cast-accent, #00FFC2)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        fontSize: '0.8125rem',
        color: 'var(--text-primary)',
        maxWidth: 360,
        minWidth: 220,
      }}
    >
      {/* Spinner dot — animation disabled via CSS media query for reduced-motion users */}
      <span
        aria-hidden="true"
        data-agent-status-spinner="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--cast-accent, #00FFC2)',
          flexShrink: 0,
          animation: 'dispatch-pulse 1.4s ease-in-out infinite',
        }}
      />

      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Running: <strong>{agent}</strong>{' '}
        <span style={{ color: 'var(--text-muted)', fontFamily: '"SF Mono", Menlo, monospace', fontSize: '0.75rem' }}>
          ({shortId})
        </span>
      </span>

      <button
        aria-label={`Cancel ${agent} agent run ${run_id}`}
        onClick={() => void handleCancel()}
        style={{
          flexShrink: 0,
          padding: '3px 10px',
          border: '1px solid var(--cast-rail-border)',
          borderRadius: 4,
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--cast-accent)'
          e.currentTarget.style.outlineOffset = '-2px'
        }}
        onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cast-accent)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cast-rail-border)' }}
      >
        Cancel
      </button>

      <style>{`
        @keyframes dispatch-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-agent-status-spinner="true"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
