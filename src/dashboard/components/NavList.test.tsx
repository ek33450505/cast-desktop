import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import NavList from './NavList'
import { NAV_ITEMS } from '../lib/navItems'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderNavList(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavList />
    </MemoryRouter>,
  )
}

describe('NavList', () => {
  it('renders a nav landmark with page navigation label', () => {
    renderNavList()
    expect(screen.getByRole('navigation', { name: /page navigation/i })).toBeInTheDocument()
  })

  it('renders all NAV_ITEMS as links', () => {
    renderNavList()
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(NAV_ITEMS.length)
  })

  it('each link has an accessible label matching the item label', () => {
    renderNavList()
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument()
    }
  })

  it('active link for "/" has aria-current="page" when on root', () => {
    renderNavList('/')
    const terminalLink = screen.getByRole('link', { name: 'Terminal' })
    expect(terminalLink).toHaveAttribute('aria-current', 'page')
  })

  it('non-root links do not have aria-current="page" when on root', () => {
    renderNavList('/')
    const sessionsLink = screen.getByRole('link', { name: 'Sessions' })
    // aria-current should not be "page" on inactive links
    expect(sessionsLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('active link for "/sessions" has aria-current="page" when on /sessions', () => {
    renderNavList('/sessions')
    const sessionsLink = screen.getByRole('link', { name: 'Sessions' })
    expect(sessionsLink).toHaveAttribute('aria-current', 'page')
  })

  it('"/" link is NOT active when on "/sessions" (end prop applied)', () => {
    renderNavList('/sessions')
    const terminalLink = screen.getByRole('link', { name: 'Terminal' })
    expect(terminalLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('each link meets ≥44px height requirement via minHeight style', () => {
    renderNavList()
    const links = screen.getAllByRole('link')
    for (const link of links) {
      const style = link.getAttribute('style') ?? ''
      expect(style).toContain('44px')
    }
  })

  it('clicking Sessions navigates to /sessions', async () => {
    const user = userEvent.setup()
    renderNavList('/')
    const sessionsLink = screen.getByRole('link', { name: 'Sessions' })
    await user.click(sessionsLink)
    // NavLink from react-router-dom handles navigation; the href should be /sessions
    expect(sessionsLink).toHaveAttribute('href', '/sessions')
  })

  it('icons have aria-hidden="true"', () => {
    renderNavList()
    // All SVG elements within nav items should be decorative
    const nav = screen.getByRole('navigation', { name: /page navigation/i })
    const svgs = nav.querySelectorAll('svg')
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  })
})
