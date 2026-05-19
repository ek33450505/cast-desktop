/**
 * OnboardingScreen — shown when CAST is not installed or DB is empty.
 *
 * State 1: No DB → full-screen overlay with install instructions.
 * State 2: DB exists but empty → dismissible banner.
 * State 3: Loading or has data → renders null.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal, Copy, Check, RefreshCw, X } from 'lucide-react'
import { useCastStatus } from '../api/useCastStatus'

const INSTALL_CMD =
  'curl -fsSL https://raw.githubusercontent.com/ek33450505/claude-agent-team/main/install.sh | bash'

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy install command"
      style={{
        background: 'var(--system-panel)',
        border: '1px solid var(--border)',
        color: copied ? 'var(--accent)' : 'var(--content-muted)',
        borderRadius: 6,
        padding: '4px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        flexShrink: 0,
        transition: 'color 0.15s',
      }}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── NoInstallOverlay (State 1) ─────────────────────────────────────────────────

function NoInstallOverlay({ onRefetch }: { onRefetch: () => void }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-heading"
      data-testid="onboarding-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--system-canvas)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
        style={{
          background: 'var(--system-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '40px 36px',
          maxWidth: 520,
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--accent-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Terminal size={26} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1
            id="onboarding-heading"
            style={{ color: 'var(--content-primary)', fontSize: 20, fontWeight: 600, margin: 0 }}
          >
            Welcome to Cast Desktop
          </h1>
          <p style={{ color: 'var(--content-muted)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            Cast Desktop reads from your CAST database. Install CAST (claude-agent-team) to get
            started.
          </p>
        </div>

        {/* Install command block */}
        <div
          style={{
            width: '100%',
            background: 'var(--system-canvas)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <code
            style={{
              flex: 1,
              fontSize: 12,
              color: 'var(--content-primary)',
              fontFamily: 'ui-monospace, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
            }}
          >
            {INSTALL_CMD}
          </code>
          <CopyButton text={INSTALL_CMD} />
        </div>

        <button
          onClick={onRefetch}
          aria-label="Check again for CAST installation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Check again
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── EmptyDbBanner (State 2) ───────────────────────────────────────────────────

function EmptyDbBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-testid="onboarding-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--accent-subtle)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: 'var(--content-primary)' }}>
        CAST detected. Start a Claude Code session to populate data.{' '}
        <a
          href="https://github.com/ek33450505/claude-agent-team"
          aria-label="View CAST on GitHub"
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >
          Learn more
        </a>
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss onboarding banner"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--content-muted)',
          display: 'flex',
          alignItems: 'center',
          padding: 4,
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </motion.div>
  )
}

// ── OnboardingScreen (public) ─────────────────────────────────────────────────

export function OnboardingScreen() {
  const { data: status, refetch } = useCastStatus()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // State 3 — loading or has data: render nothing
  if (!status || status.dbHasData) return null

  // State 1 — CAST not installed
  if (!status.dbExists) {
    return <NoInstallOverlay onRefetch={() => void refetch()} />
  }

  // State 2 — DB exists but empty
  if (!bannerDismissed) {
    return <EmptyDbBanner onDismiss={() => setBannerDismissed(true)} />
  }

  return null
}
