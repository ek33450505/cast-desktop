/**
 * AgentStatusBadge — display-only pill badge for CAST agent run statuses.
 *
 * Variants: 'DONE' | 'DONE_WITH_CONCERNS' | 'BLOCKED' | 'NEEDS_CONTEXT' | 'IN_PROGRESS' | 'RUNNING' | string (fallback)
 *
 * a11y:
 * - role="img" with aria-label carrying full sr-only meaning
 * - Unknown statuses fall through to neutral gray variant
 * - No interactive role — display-only, no tab stop
 */

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variant config ─────────────────────────────────────────────────────────────

const KNOWN_STATUSES = ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT', 'IN_PROGRESS', 'RUNNING'] as const
export type KnownAgentStatus = (typeof KNOWN_STATUSES)[number]

interface StatusConfig {
  colorClasses: string
  ariaLabel: string
  displayText: string
}

const STATUS_CONFIG: Record<KnownAgentStatus, StatusConfig> = {
  DONE: {
    colorClasses: 'bg-emerald-500/20 text-emerald-300',
    ariaLabel: 'Status: Done',
    displayText: 'DONE',
  },
  DONE_WITH_CONCERNS: {
    colorClasses: 'bg-amber-500/20 text-amber-300',
    ariaLabel: 'Status: Done with concerns',
    displayText: 'DONE_WITH_CONCERNS',
  },
  BLOCKED: {
    colorClasses: 'bg-rose-500/20 text-rose-300',
    ariaLabel: 'Status: Blocked',
    displayText: 'BLOCKED',
  },
  NEEDS_CONTEXT: {
    colorClasses: 'bg-sky-500/20 text-sky-300',
    ariaLabel: 'Status: Needs context',
    displayText: 'NEEDS_CONTEXT',
  },
  IN_PROGRESS: {
    colorClasses: 'bg-cyan-500/20 text-cyan-300',
    ariaLabel: 'Status: In progress',
    displayText: 'IN_PROGRESS',
  },
  RUNNING: {
    colorClasses: 'bg-cyan-500/20 text-cyan-300',
    ariaLabel: 'Status: Running',
    displayText: 'RUNNING',
  },
}

const FALLBACK_CONFIG: StatusConfig = {
  colorClasses: 'bg-zinc-500/20 text-zinc-300',
  ariaLabel: '',
  displayText: '',
}

// ── CVA badge shell ────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center font-medium leading-none text-[10px] px-1.5 py-0.5 rounded',
)

// ── Props ──────────────────────────────────────────────────────────────────────

export interface AgentStatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status: KnownAgentStatus | string
  className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const isKnown = (KNOWN_STATUSES as readonly string[]).includes(status)
  const config = isKnown
    ? STATUS_CONFIG[status as KnownAgentStatus]
    : {
        ...FALLBACK_CONFIG,
        ariaLabel: `Status: ${status}`,
        displayText: status,
      }

  return (
    <span
      role="img"
      aria-label={config.ariaLabel}
      className={cn(badgeVariants(), config.colorClasses, className)}
    >
      {config.displayText}
    </span>
  )
}
