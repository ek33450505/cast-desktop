/**
 * ModalHeader — reusable modal header bar for Cast Desktop dialogs.
 *
 * Props:
 * - icon?: LucideIcon (decorative, aria-hidden)
 * - title: string (visible title text)
 * - onClose?: () => void (close button — omitted when undefined)
 * - className?: string
 * - id?: string (applied to the title element — allows consumers to use aria-labelledby)
 *
 * a11y:
 * - Icon is aria-hidden="true" (decorative)
 * - Close button has aria-label="Close"
 * - Semantic <header> element with border-b separator
 * - Pass `id` to expose the title as an aria-labelledby target without a wrapper div
 */

import type React from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ModalHeaderProps {
  icon?: LucideIcon
  title: string
  onClose?: () => void
  className?: string
  id?: string
  /** Optional action buttons rendered between the title and close button */
  actions?: React.ReactNode
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ModalHeader({ icon: Icon, title, onClose, className, id, actions }: ModalHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center gap-2 px-4 py-3 border-b border-[var(--stroke-regular)] flex-shrink-0',
        className,
      )}
    >
      {Icon && (
        <span aria-hidden="true" className="flex-shrink-0 text-[var(--content-secondary)]">
          <Icon className="w-4 h-4" />
        </span>
      )}

      <p id={id} className="text-sm font-medium text-[var(--content-primary)] truncate min-w-0 flex-1">
        {title}
      </p>

      {actions && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}
        </div>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center rounded text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1 flex-shrink-0"
          style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </header>
  )
}
