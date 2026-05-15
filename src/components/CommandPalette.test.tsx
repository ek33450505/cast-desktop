import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CommandPalette from './CommandPalette'
import { MemoryPage } from '../dashboard/pages/StubPages'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// framer-motion: render children immediately, no animation delays
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div {...props}>{children}</div>
      ),
    },
    useReducedMotion: () => false,
  }
})

function renderPalette(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} />
    </MemoryRouter>,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders when open=true', () => {
    renderPalette(true)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    renderPalette(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('has correct aria attributes', () => {
    renderPalette(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Command palette')
  })

  it('search input has aria-label', () => {
    renderPalette(true)
    expect(screen.getByLabelText('Search commands')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    renderPalette(true, onClose)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderPalette(true, onClose)
    const backdrop = screen.getByTestId('palette-backdrop')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    renderPalette(true, onClose)
    const closeBtn = screen.getByRole('button', { name: /close command palette/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates to route and closes on item select', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderPalette(true, onClose)

    const sessionsItem = screen.getByRole('option', { name: /sessions/i })
    await user.click(sessionsItem)

    expect(mockNavigate).toHaveBeenCalledWith('/sessions')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('filters items when typing a route name', async () => {
    const user = userEvent.setup()
    renderPalette(true)
    const input = screen.getByLabelText('Search commands')
    await user.type(input, 'analytics')

    expect(screen.getByRole('option', { name: /analytics/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^Sessions Sessions \/sessions/i })).not.toBeInTheDocument()
  })

  it('shows current set of nav items when no search', () => {
    renderPalette(true)
    const items = screen.getAllByRole('option')
    // 8 original nav items + 1 Open Editor item added in IDE-1 + 1 ~/.claude/ Vault
    expect(items.length).toBe(10)
  })

  it('focus trap: Tab from last focusable element wraps to first (search input)', async () => {
    const user = userEvent.setup()
    renderPalette(true)

    // The close button is the last tabbable element inside the dialog
    const closeBtn = screen.getByRole('button', { name: /close command palette/i })
    closeBtn.focus()
    expect(document.activeElement).toBe(closeBtn)

    // Tab from the last element — should wrap to the search input (first focusable)
    await user.tab()

    const searchInput = screen.getByLabelText('Search commands')
    expect(document.activeElement).toBe(searchInput)
  })
})

describe('StubPage rendering', () => {
  it('MemoryPage renders stub heading', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <MemoryPage />
      </MemoryRouter>,
    )
    expect(getByRole('heading', { name: /memory/i })).toBeInTheDocument()
  })

  it('MemoryPage does not contain internal placeholder copy', () => {
    const { queryByText } = render(
      <MemoryRouter>
        <MemoryPage />
      </MemoryRouter>,
    )
    expect(queryByText(/repatriates from claude-code-dashboard/i)).not.toBeInTheDocument()
  })

  it('MemoryPage renders public-ready subtitle', () => {
    const { getByText } = render(
      <MemoryRouter>
        <MemoryPage />
      </MemoryRouter>,
    )
    expect(getByText(/inspect agent and project memory/i)).toBeInTheDocument()
  })
})
