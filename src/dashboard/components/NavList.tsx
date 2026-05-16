import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../lib/navItems'

/**
 * NavList — vertical page-navigation list for the left rail.
 * Renders one NavLink per NAV_ITEMS entry. Active route gets aria-current="page"
 * and a highlighted background. Each item meets the ≥44×44px hit-target requirement.
 */
export default function NavList() {
  return (
    <nav aria-label="Page navigation" className="flex flex-col py-2 px-2 gap-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            aria-label={item.label}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 rounded-md text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--stroke-focus)] focus-visible:outline-offset-1',
                isActive
                  ? 'bg-[var(--accent-muted)] text-[var(--content-primary)]'
                  : 'text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--accent-muted)]',
              ].join(' ')
            }
            style={{ minHeight: '44px' }}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={[
                    'w-4 h-4 shrink-0',
                    isActive ? 'text-[var(--content-primary)]' : 'text-[var(--content-muted)]',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
