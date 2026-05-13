import { Sun, Moon } from 'lucide-react'
import { useAppearance } from '../../hooks/useAppearance'

/**
 * AppearanceToggle — top-bar icon button that flips between dawn and dusk.
 *
 * - 44×44px touch target (design language §6)
 * - aria-label reflects the action (what will happen when clicked)
 * - aria-pressed reflects current state
 * - focus-visible outline uses --stroke-focus
 * - hover uses --accent-muted background
 * - matches the existing top-bar icon-button pattern from TopBar.tsx
 */
export default function AppearanceToggle() {
  const { appearance, toggle } = useAppearance()
  const isDusk = appearance === 'dusk'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDusk ? 'Switch to dawn appearance' : 'Switch to dusk appearance'}
      aria-pressed={!isDusk}
      className="flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--cast-rail-bg)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-2"
      style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
    >
      {isDusk
        ? <Sun className="w-4 h-4" aria-hidden="true" />
        : <Moon className="w-4 h-4" aria-hidden="true" />}
    </button>
  )
}
