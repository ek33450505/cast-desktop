import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TerminalSearchOverlay } from './TerminalSearchOverlay'

// framer-motion — use reduced motion to skip animation lifecycle side effects
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => true),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// requestAnimationFrame — synchronous so focus() in useEffect fires immediately
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: (cb: FrameRequestCallback) => { cb(0); return 0 },
})

function buildProps(overrides: Partial<Parameters<typeof TerminalSearchOverlay>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onSearch: vi.fn(),
    onClear: vi.fn(),
    matchCount: null,
    ...overrides,
  }
}

describe('TerminalSearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the search input', () => {
    render(<TerminalSearchOverlay {...buildProps()} />)
    expect(screen.getByLabelText(/search terminal/i)).toBeTruthy()
  })

  it('renders Prev, Next, and Close buttons', () => {
    render(<TerminalSearchOverlay {...buildProps()} />)
    expect(screen.getByRole('button', { name: /previous match/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /next match/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /close search/i })).toBeTruthy()
  })

  it('calls onSearch with direction "next" when Enter is pressed', () => {
    const onSearch = vi.fn()
    render(<TerminalSearchOverlay {...buildProps({ onSearch })} />)

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('hello', 'next')
  })

  it('calls onSearch with direction "prev" when Shift+Enter is pressed', () => {
    const onSearch = vi.fn()
    render(<TerminalSearchOverlay {...buildProps({ onSearch })} />)

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.change(input, { target: { value: 'world' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(onSearch).toHaveBeenCalledWith('world', 'prev')
  })

  it('calls onClose when Escape is pressed in the input', () => {
    const onClose = vi.fn()
    render(<TerminalSearchOverlay {...buildProps({ onClose })} />)

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClear and onClose at least once when Close button is clicked', () => {
    const onClose = vi.fn()
    const onClear = vi.fn()
    render(<TerminalSearchOverlay {...buildProps({ onClose, onClear })} />)

    fireEvent.click(screen.getByRole('button', { name: /close search/i }))

    expect(onClear).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSearch("next") when Next button is clicked', () => {
    const onSearch = vi.fn()
    render(<TerminalSearchOverlay {...buildProps({ onSearch })} />)

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.click(screen.getByRole('button', { name: /next match/i }))

    expect(onSearch).toHaveBeenCalledWith('foo', 'next')
  })

  it('calls onSearch("prev") when Prev button is clicked', () => {
    const onSearch = vi.fn()
    render(<TerminalSearchOverlay {...buildProps({ onSearch })} />)

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.change(input, { target: { value: 'bar' } })
    fireEvent.click(screen.getByRole('button', { name: /previous match/i }))

    expect(onSearch).toHaveBeenCalledWith('bar', 'prev')
  })

  it('shows match count label when matchCount is provided and query is non-empty', () => {
    render(
      <TerminalSearchOverlay
        {...buildProps({ matchCount: { current: 2, total: 5 } })}
      />,
    )

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.change(input, { target: { value: 'test' } })

    expect(screen.getByText('2 of 5')).toBeTruthy()
  })

  it('shows "No results" when matchCount.total is 0 and query is non-empty', () => {
    render(
      <TerminalSearchOverlay
        {...buildProps({ matchCount: { current: 0, total: 0 } })}
      />,
    )

    const input = screen.getByLabelText(/search terminal/i)
    fireEvent.change(input, { target: { value: 'notfound' } })

    expect(screen.getByText('No results')).toBeTruthy()
  })
})
