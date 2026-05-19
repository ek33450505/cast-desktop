import type { ReactNode } from 'react'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './ui/hover-card'

export interface HoverPreviewItem {
  label: string
  value: string
}

export interface HoverPreviewProps {
  trigger: ReactNode
  title: string
  items?: HoverPreviewItem[]
  badge?: ReactNode
  description?: string
}

/**
 * HoverPreview — generic hover card wrapper used across AgentsView,
 * PlansPage, and LiveAgentsPanel to surface contextual metadata.
 *
 * Uses the @base-ui/react PreviewCard primitive (via ui/hover-card.tsx).
 * Delay and close-delay are on the Trigger.
 *
 * a11y: the trigger renders as a focusable span (tabIndex=0) with a visible
 * focus-visible ring so that base-ui's PreviewCard opens on keyboard focus
 * in addition to mouse hover. The span is preferred over <button> so the
 * trigger can sit inside other interactive elements (table rows, clickable
 * cards) without nesting interactive HTML.
 */
export function HoverPreview({ trigger, title, items, badge, description }: HoverPreviewProps) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        closeDelay={150}
        render={
          <span
            tabIndex={0}
            className="cursor-default inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--system-base)]"
          />
        }
      >
        {trigger}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="min-w-[220px] max-w-[320px] p-3 rounded-xl text-sm"
        style={{
          background: 'var(--system-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--content)',
        }}
      >
        <div className="space-y-2">
          {/* Title row + optional badge */}
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm truncate"
              style={{ color: 'var(--content-primary)' }}
            >
              {title}
            </span>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>

          {/* Optional description */}
          {description && (
            <p
              className="text-xs leading-snug line-clamp-2"
              style={{ color: 'var(--content-secondary)' }}
            >
              {description}
            </p>
          )}

          {/* Key/value items */}
          {items && items.length > 0 && (
            <dl className="space-y-1">
              {items.map(({ label, value }) => (
                <div key={label} className="flex gap-1.5 text-xs">
                  <dt
                    className="shrink-0 font-medium"
                    style={{ color: 'var(--content-muted)' }}
                  >
                    {label}:
                  </dt>
                  <dd
                    className="truncate"
                    style={{ color: 'var(--content-secondary)' }}
                    title={value}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
