import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AppearanceToggle from './AppearanceToggle'
import type { Appearance } from '../../hooks/useAppearance'

// ── mock useAppearance ────────────────────────────────────────────────────────

let mockAppearance: Appearance = 'dusk'
const mockToggle = vi.fn()
const mockSetAppearance = vi.fn()

vi.mock('../../hooks/useAppearance', () => ({
  useAppearance: () => ({
    appearance: mockAppearance,
    toggle: mockToggle,
    setAppearance: mockSetAppearance,
  }),
  getInitialAppearance: () => 'dusk' as Appearance,
  applyAppearance: vi.fn(),
}))

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockAppearance = 'dusk'
  mockToggle.mockReset()
  mockSetAppearance.mockReset()
  document.documentElement.removeAttribute('data-appearance')
})

afterEach(() => {
  document.documentElement.removeAttribute('data-appearance')
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AppearanceToggle', () => {
  it('renders Sun icon when appearance is dusk (action: switch to dawn)', () => {
    mockAppearance = 'dusk'
    render(<AppearanceToggle />)
    // Sun icon is shown when dusk so user can switch to dawn
    const button = screen.getByRole('button')
    expect(button.querySelector('svg')).toBeTruthy()
    expect(button).toHaveAttribute('aria-label', 'Switch to dawn appearance')
  })

  it('renders Moon icon when appearance is dawn (action: switch to dusk)', () => {
    mockAppearance = 'dawn'
    render(<AppearanceToggle />)
    const button = screen.getByRole('button')
    expect(button.querySelector('svg')).toBeTruthy()
    expect(button).toHaveAttribute('aria-label', 'Switch to dusk appearance')
  })

  it('aria-label is correct for dusk state', () => {
    mockAppearance = 'dusk'
    render(<AppearanceToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dawn appearance')
  })

  it('aria-label is correct for dawn state', () => {
    mockAppearance = 'dawn'
    render(<AppearanceToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dusk appearance')
  })

  it('aria-pressed is false when appearance is dusk', () => {
    mockAppearance = 'dusk'
    render(<AppearanceToggle />)
    // aria-pressed reflects current dawn state — false when dusk
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('aria-pressed is true when appearance is dawn', () => {
    mockAppearance = 'dawn'
    render(<AppearanceToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking the button calls toggle()', () => {
    mockAppearance = 'dusk'
    render(<AppearanceToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockToggle).toHaveBeenCalledOnce()
  })

  it('has 44px touch target dimensions', () => {
    mockAppearance = 'dusk'
    render(<AppearanceToggle />)
    const button = screen.getByRole('button')
    expect(button).toHaveStyle({ width: '44px', height: '44px' })
  })
})
