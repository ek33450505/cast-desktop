import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppearanceToggle from './AppearanceToggle'
import { AppIconSVG } from './AppIcon'

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
      className="text-xs tabular-nums select-none text-[var(--text-muted)]"
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
      className="flex items-center justify-between shrink-0"
      style={{
        height: '44px',
        background: 'var(--system-chrome)',
        paddingLeft: '16px',
        paddingRight: '8px',
      }}
    >
      {/* ── Left: app icon + product wordmark + clock ───────────────────── */}
      <div className="flex items-center gap-3">
        <AppIconSVG size={24} aria-hidden="true" />
        <span
          className="text-sm font-semibold tracking-tight select-none"
          style={{
            color: 'var(--content-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          cast-desktop
        </span>
        <span
          className="text-xs select-none"
          style={{ color: 'var(--content-muted)' }}
          aria-hidden="true"
        >
          ·
        </span>
        <HeaderClock />
      </div>

      {/* ── Right: search + rail toggles + appearance ────────────────────── */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette (⌘K)"
          title="Command palette (⌘K)"
          className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ width: '36px', height: '36px' }}
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onToggleLeft}
          aria-label={leftRailOpen ? 'Collapse left rail (⌘B)' : 'Expand left rail (⌘B)'}
          title={leftRailOpen ? 'Collapse left rail (⌘B)' : 'Expand left rail (⌘B)'}
          className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ width: '36px', height: '36px' }}
        >
          {leftRailOpen
            ? <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            : <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={onToggleRight}
          aria-label={rightRailOpen ? 'Collapse right rail (⌘⌥B)' : 'Expand right rail (⌘⌥B)'}
          title={rightRailOpen ? 'Collapse right rail (⌘⌥B)' : 'Expand right rail (⌘⌥B)'}
          className="flex items-center justify-center rounded-md text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
          style={{ width: '36px', height: '36px' }}
        >
          {rightRailOpen
            ? <PanelRightClose className="w-4 h-4" aria-hidden="true" />
            : <PanelRightOpen className="w-4 h-4" aria-hidden="true" />}
        </button>

        <AppearanceToggle />
      </div>
    </header>
  )
}
