/**
 * AriaTab — canonical accessible tab primitives for Cast Desktop.
 *
 * Exports: AriaTabList, AriaTab, AriaTabPanel
 *
 * Usage:
 *   <AriaTabList>
 *     <AriaTab id="rows" controls="rows-panel" active={tab === 'rows'} onSelect={() => setTab('rows')}>Rows</AriaTab>
 *     <AriaTab id="schema" controls="schema-panel" active={tab === 'schema'} onSelect={() => setTab('schema')}>Schema</AriaTab>
 *   </AriaTabList>
 *   <AriaTabPanel id="rows-panel" labelledBy="rows" hidden={tab !== 'rows'}>...</AriaTabPanel>
 *
 * ARIA contract:
 * - AriaTabList: role="tablist"
 * - AriaTab: role="tab", aria-selected, aria-controls, tabIndex managed, keyboard nav
 * - AriaTabPanel: role="tabpanel", aria-labelledby, hidden attribute
 */

import { cn } from '@/lib/utils'

// ── AriaTabList ────────────────────────────────────────────────────────────────

export interface AriaTabListProps {
  children: React.ReactNode
  'aria-label'?: string
  className?: string
}

export function AriaTabList({ children, 'aria-label': ariaLabel, className }: AriaTabListProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex', className)}>
      {children}
    </div>
  )
}

// ── AriaTab ────────────────────────────────────────────────────────────────────

export interface AriaTabProps {
  id: string
  controls: string
  active: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
}

export function AriaTab({ id, controls, active, onSelect, children, className }: AriaTabProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const tablist = e.currentTarget.parentElement
    if (!tablist) return

    const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'))
    const currentIdx = tabs.indexOf(e.currentTarget)
    let nextIdx: number | null = null

    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = tabs.length - 1
    }

    if (nextIdx !== null) {
      e.preventDefault()
      const nextTab = tabs[nextIdx] as HTMLButtonElement
      nextTab.click()
      nextTab.focus()
    }
  }

  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'px-4 py-2.5 text-sm font-medium relative motion-safe:transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
        'min-h-[44px] min-w-[44px]',
        active
          ? 'text-[var(--accent)]'
          : 'text-[var(--content-muted)] hover:text-[var(--content-primary)]',
        className,
      )}
    >
      {children}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ background: 'var(--accent)' }}
          aria-hidden="true"
        />
      )}
    </button>
  )
}

// ── AriaTabPanel ───────────────────────────────────────────────────────────────

export interface AriaTabPanelProps {
  id: string
  labelledBy: string
  hidden?: boolean
  children: React.ReactNode
  className?: string
}

export function AriaTabPanel({ id, labelledBy, hidden, children, className }: AriaTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      hidden={hidden}
      className={className}
    >
      {children}
    </div>
  )
}
