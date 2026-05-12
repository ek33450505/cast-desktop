import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Settings } from 'lucide-react'

interface TopBarProps {
  leftRailOpen: boolean
  rightRailOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}

export default function TopBar({
  leftRailOpen,
  rightRailOpen,
  onToggleLeft,
  onToggleRight,
}: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-3 shrink-0"
      style={{
        height: '48px',
        background: 'var(--cast-top-bar-bg)',
        borderBottom: '1px solid var(--cast-rail-border)',
      }}
    >
      {/* Left side: project name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight select-none">
          cast-desktop
        </span>
      </div>

      {/* Right side: rail toggles + settings */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleLeft}
          aria-label={leftRailOpen ? 'Collapse left rail (⌘B)' : 'Expand left rail (⌘B)'}
          className="flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--cast-rail-bg)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-2"
          style={{ width: '36px', height: '36px', minWidth: '44px', minHeight: '44px' }}
        >
          {leftRailOpen
            ? <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            : <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={onToggleRight}
          aria-label={rightRailOpen ? 'Collapse right rail (⌘⌥B)' : 'Expand right rail (⌘⌥B)'}
          className="flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--cast-rail-bg)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-2"
          style={{ width: '36px', height: '36px', minWidth: '44px', minHeight: '44px' }}
        >
          {rightRailOpen
            ? <PanelRightClose className="w-4 h-4" aria-hidden="true" />
            : <PanelRightOpen className="w-4 h-4" aria-hidden="true" />}
        </button>

        <button
          type="button"
          aria-label="Settings (stub)"
          className="flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--cast-rail-bg)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-2"
          style={{ width: '36px', height: '36px', minWidth: '44px', minHeight: '44px' }}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
