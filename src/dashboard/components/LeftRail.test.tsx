import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LeftRail from './LeftRail'

// ── mock framer-motion ────────────────────────────────────────────────────────

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => true), // skip animations in tests
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div {...props}>{children}</div>
      ),
    },
  }
})

// ── helpers ───────────────────────────────────────────────────────────────────

function renderRail(open = true, initialPath = '/') {
  const onExpand = vi.fn()
  const result = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LeftRail open={open} onExpand={onExpand} />
    </MemoryRouter>,
  )
  return { ...result, onExpand }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LeftRail — D.8 nav list', () => {
  it('renders a nav landmark', () => {
    renderRail()
    // Both the outer nav and the inner NavList nav are landmarks; at least one present
    const navLandmarks = screen.getAllByRole('navigation')
    expect(navLandmarks.length).toBeGreaterThanOrEqual(1)
  })

  it('when open, renders NavList page navigation links', () => {
    renderRail(true)
    // NavList renders a navigation with "page navigation" label
    expect(screen.getByRole('navigation', { name: /page navigation/i })).toBeInTheDocument()
  })

  it('when open, Terminal link is visible', () => {
    renderRail(true, '/')
    expect(screen.getByRole('link', { name: 'Terminal' })).toBeInTheDocument()
  })

  it('when open, Sessions link is visible', () => {
    renderRail(true)
    expect(screen.getByRole('link', { name: 'Sessions' })).toBeInTheDocument()
  })

  it('when collapsed, shows expand button instead of NavList links', () => {
    renderRail(false)
    expect(screen.getByRole('button', { name: /expand navigation rail/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Terminal' })).not.toBeInTheDocument()
  })

  it('clicking expand button calls onExpand', () => {
    const { onExpand } = renderRail(false)
    const btn = screen.getByRole('button', { name: /expand navigation rail/i })
    fireEvent.click(btn)
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('Terminal link has aria-current="page" when route is /', () => {
    renderRail(true, '/')
    const terminalLink = screen.getByRole('link', { name: 'Terminal' })
    expect(terminalLink).toHaveAttribute('aria-current', 'page')
  })

  it('Sessions link has aria-current="page" when route is /sessions', () => {
    renderRail(true, '/sessions')
    const sessionsLink = screen.getByRole('link', { name: 'Sessions' })
    expect(sessionsLink).toHaveAttribute('aria-current', 'page')
  })
})
