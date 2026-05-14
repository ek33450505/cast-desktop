import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TopBar from './TopBar'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./AppearanceToggle', () => ({
  default: () => <button aria-label="Toggle appearance (stub)" />,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  leftRailOpen: true,
  rightRailOpen: true,
  onToggleLeft: vi.fn(),
  onToggleRight: vi.fn(),
  onOpenPalette: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TopBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T20:47:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders cast-desktop label', () => {
    render(<TopBar {...DEFAULT_PROPS} />)
    expect(screen.getByText('cast-desktop')).toBeInTheDocument()
  })

  it('renders a <time> element with aria-label', () => {
    render(<TopBar {...DEFAULT_PROPS} />)
    const timeEl = screen.getByRole('time')
    expect(timeEl).toBeInTheDocument()
    expect(timeEl.getAttribute('aria-label')).toBe('Current time and date')
  })

  it('time element has a dateTime ISO attribute', () => {
    render(<TopBar {...DEFAULT_PROPS} />)
    const timeEl = screen.getByRole('time')
    const dt = timeEl.getAttribute('dateTime') ?? ''
    // Should be a valid ISO 8601 string
    expect(() => new Date(dt)).not.toThrow()
    expect(new Date(dt).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('displays a time string matching HH:MM format', () => {
    render(<TopBar {...DEFAULT_PROPS} />)
    const timeEl = screen.getByRole('time')
    // Should contain colon-separated hours and minutes
    expect(timeEl.textContent).toMatch(/\d{1,2}:\d{2}/)
  })

  it('displays a day-of-week abbreviation in the clock', () => {
    render(<TopBar {...DEFAULT_PROPS} />)
    const timeEl = screen.getByRole('time')
    // Should contain a weekday abbreviation (Mon, Tue, Wed…)
    expect(timeEl.textContent).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)
  })

  it('renders all four control buttons (palette, left rail, right rail, settings)', () => {
    render(<TopBar {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse left rail/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse right rail/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })
})
