/**
 * DispatchModal — IDE-5: "Dispatch agent" modal opened by Cmd+Shift+A.
 *
 * Shows an agent picker + pre-filled prompt textarea and POSTs to
 * /api/dispatch when the user confirms.
 *
 * A11y:
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap: Tab / Shift+Tab cycle within the modal
 * - Escape = Cancel
 * - Textarea autofocused on open
 *
 * Pattern-matched from UnsavedChangesModal.tsx for structure + styling.
 */

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'

// ── Constants ──────────────────────────────────────────────────────────────────

export const DISPATCH_AGENTS = ['code-writer', 'debugger', 'test-writer', 'researcher'] as const
export type DispatchAgent = typeof DISPATCH_AGENTS[number]

const AGENT_LABELS: Record<DispatchAgent, string> = {
  'code-writer': 'Code Writer',
  'debugger': 'Debugger',
  'test-writer': 'Test Writer',
  'researcher': 'Researcher',
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface DispatchModalProps {
  /** Initial prompt text — pre-filled with file context + selection */
  initialPrompt: string
  /** Working directory passed to the agent */
  cwd: string
  onClose: () => void
  /** Called when dispatch succeeds; parent uses run_id to show status panel */
  onDispatched: (run_id: string, agent: DispatchAgent) => void
}

// ── DispatchModal ──────────────────────────────────────────────────────────────

export function DispatchModal({
  initialPrompt,
  cwd,
  onClose,
  onDispatched,
}: DispatchModalProps) {
  const shouldReduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [agent, setAgent] = useState<DispatchAgent>('code-writer')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [dispatching, setDispatching] = useState(false)

  // Autofocus textarea on open — move cursor to end so user can start typing
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [])

  // Escape = Close; Tab focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Cmd+Enter (or Ctrl+Enter) = submit
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey
      if (metaOrCtrl && e.key === 'Enter' && !dispatching) {
        e.preventDefault()
        void handleDispatch()
        return
      }

      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
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
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, dispatching, prompt, agent])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleDispatch = async () => {
    if (!prompt.trim()) {
      toast.error('Prompt cannot be empty')
      return
    }
    setDispatching(true)
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, prompt, cwd }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { run_id: string }
      onDispatched(body.run_id, agent)
      onClose()
    } catch (err) {
      toast.error(`Dispatch failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDispatching(false)
    }
  }

  const headingId = 'dispatch-modal-heading'

  // ── Styles — pattern-matched from UnsavedChangesModal ─────────────────────
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    animation: shouldReduceMotion ? 'none' : 'cast-fade-in 0.1s ease',
  }

  const dialogStyle: React.CSSProperties = {
    background: 'var(--cast-center-bg)',
    border: '1px solid var(--cast-rail-border)',
    borderRadius: 10,
    padding: '24px 28px',
    minWidth: 420,
    maxWidth: 560,
    width: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    animation: shouldReduceMotion ? 'none' : 'cast-slide-up 0.1s ease',
  }

  const baseButtonStyle: React.CSSProperties = {
    padding: '7px 16px',
    fontSize: '0.8125rem',
    borderRadius: 6,
    cursor: 'pointer',
    outline: 'none',
    fontWeight: 500,
  }

  return (
    <>
      <style>{`
        @keyframes cast-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cast-slide-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={backdropStyle} onClick={handleBackdropClick} data-testid="dispatch-backdrop">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          style={dialogStyle}
          data-testid="dispatch-modal"
        >
          <h2
            id={headingId}
            style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Dispatch Agent
          </h2>

          {/* Agent picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="dispatch-agent-picker"
              style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}
            >
              Agent
            </label>
            <select
              id="dispatch-agent-picker"
              value={agent}
              onChange={(e) => setAgent(e.target.value as DispatchAgent)}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--cast-rail-border)',
                borderRadius: 6,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              {DISPATCH_AGENTS.map((a) => (
                <option key={a} value={a}>{AGENT_LABELS[a]}</option>
              ))}
            </select>
          </div>

          {/* Prompt textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="dispatch-prompt"
              style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}
            >
              Prompt
              <span
                style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', opacity: 0.7 }}
                aria-hidden="true"
              >
                Cmd+Enter to submit
              </span>
            </label>
            <textarea
              ref={textareaRef}
              id="dispatch-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              aria-label="Agent prompt — describe the task for the agent to perform"
              aria-describedby="dispatch-prompt-hint"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--cast-rail-border)',
                borderRadius: 6,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                fontFamily: '"SF Mono", Menlo, Monaco, monospace',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            />
            <span
              id="dispatch-prompt-hint"
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}
            >
              The agent will work in: {cwd}
            </span>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              borderTop: '1px solid var(--cast-rail-border)',
              paddingTop: 16,
            }}
          >
            <button
              aria-label="Cancel — close without dispatching"
              style={{
                ...baseButtonStyle,
                border: '1px solid var(--cast-rail-border)',
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
              onClick={onClose}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Cancel
            </button>

            <button
              aria-label={`Dispatch ${AGENT_LABELS[agent]} agent`}
              disabled={dispatching}
              style={{
                ...baseButtonStyle,
                border: 'none',
                background: dispatching ? 'var(--bg-tertiary)' : 'var(--cast-accent)',
                color: dispatching ? 'var(--text-muted)' : 'var(--bg-primary)',
                fontWeight: 600,
                cursor: dispatching ? 'wait' : 'pointer',
              }}
              onClick={() => void handleDispatch()}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--text-primary)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              {dispatching ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
