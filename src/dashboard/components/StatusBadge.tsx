/**
 * StatusBadge — reusable display-only pill badge for table/agent status.
 *
 * Variants: 'no-writer' | 'deferred' | 'failed' | 'healthy' | 'warning'
 * Sizes: 'sm' (default, sidebar inline) | 'md' (page-level)
 *
 * a11y:
 * - role="img" with aria-label carrying full sr-only meaning
 * - sr-only span for screen readers
 * - aria-hidden visible text (color + text, not color alone)
 * - No interactive role — display-only, no tab stop
 */

import { cn } from '../lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type StatusBadgeVariant = 'no-writer' | 'deferred' | 'failed' | 'healthy' | 'warning'
export type StatusBadgeSize = 'sm' | 'md'

export interface StatusBadgeProps {
  variant: StatusBadgeVariant
  size?: StatusBadgeSize
  /** Overrides the default display text for the variant */
  label?: string
  className?: string
}

// ── Variant config ─────────────────────────────────────────────────────────────

interface VariantConfig {
  defaultText: string
  colorClasses: string
  srOnlyTitle: string
}

const VARIANT_CONFIG: Record<StatusBadgeVariant, VariantConfig> = {
  'no-writer': {
    defaultText: 'no writer',
    colorClasses: 'bg-amber-500/30 text-amber-200',
    srOnlyTitle: 'Table has no writer — data will always be empty',
  },
  deferred: {
    defaultText: 'stub',
    colorClasses: 'bg-zinc-500/30 text-zinc-300',
    srOnlyTitle: 'Table is a deferred stub — no writer and no reader',
  },
  failed: {
    defaultText: 'failed',
    colorClasses: 'bg-red-500/30 text-red-200',
    srOnlyTitle: 'Status: failed',
  },
  healthy: {
    defaultText: 'ok',
    colorClasses: 'bg-emerald-500/30 text-emerald-200',
    srOnlyTitle: 'Status: healthy',
  },
  warning: {
    defaultText: 'warn',
    colorClasses: 'bg-yellow-500/30 text-yellow-200',
    srOnlyTitle: 'Status: warning',
  },
}

// ── Size config ────────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 rounded',
  md: 'text-xs px-2 py-1 rounded-md',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StatusBadge({ variant, size = 'sm', label, className }: StatusBadgeProps) {
  const config = VARIANT_CONFIG[variant]
  const displayText = label ?? config.defaultText

  return (
    <span
      role="img"
      aria-label={config.srOnlyTitle}
      className={cn(
        'inline-flex items-center font-medium leading-none',
        config.colorClasses,
        SIZE_CLASSES[size],
        className,
      )}
    >
      <span className="sr-only">{config.srOnlyTitle}</span>
      <span aria-hidden="true">{displayText}</span>
    </span>
  )
}
