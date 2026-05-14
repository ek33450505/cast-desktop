import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppearanceToggle from './AppearanceToggle'

// ── HeaderClock ───────────────────────────────────────────────────────────────

function formatClock(date: Date): { display: string; iso: string } {
  const display = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return { display, iso: date.toISOString() }
}

function HeaderClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Align to the next whole minute, then tick every 60 s
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    let interval: ReturnType<typeof setInterval> | null = null

    const timeout = setTimeout(() => {
      setNow(new Date())
      interval = setInterval(() => setNow(new Date()), 60_000)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeout)
      if (interval !== null) clearInterval(interval)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { display, iso } = formatClock(now)

  return (
    <time
      dateTime={iso}
      aria-label="Current time and date"
      className="text-xs tabular-nums select-none px-2 text-[var(--text-muted)]"
    >
      {display}
    </time>
  )
}

interface TopBarProps {
  leftRailOpen: boolean
  rightRailOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  onOpenPalette: () => void
}

export default function TopBar({
  leftRailOpen,
  rightRailOpen,
  onToggleLeft,
  onToggleRight,
  onOpenPalette,
}: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-3 shrink-0"
      style={{
        height: '48px',
        background: 'var(--system-chrome)',
        borderBottom: '1px solid var(--stroke-subtle)',
      }}
    >
      {/* Left side: project name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight select-none">
          cast-desktop
        </span>
        <HeaderClock />
      </div>

      {/* Right side: ⌘K trigger + rail toggles + settings */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette (⌘K)"
          className="flex items-center justify-center gap-1.5 px-2.5 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ height: '44px', minHeight: '44px' }}
        >
          <span className="font-mono">⌘K</span>
        </button>

        <button
          type="button"
          onClick={onToggleLeft}
          aria-label={leftRailOpen ? 'Collapse left rail (⌘B)' : 'Expand left rail (⌘B)'}
          className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
        >
          {leftRailOpen
            ? <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            : <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={onToggleRight}
          aria-label={rightRailOpen ? 'Collapse right rail (⌘⌥B)' : 'Expand right rail (⌘⌥B)'}
          className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
        >
          {rightRailOpen
            ? <PanelRightClose className="w-4 h-4" aria-hidden="true" />
            : <PanelRightOpen className="w-4 h-4" aria-hidden="true" />}
        </button>

        <AppearanceToggle />

        <button
          type="button"
          aria-label="Settings (stub)"
          className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
