/**
 * Tests for OnboardingScreen.
 *
 * Covers:
 *   - State 1 (no db): full-screen overlay renders with heading and install command
 *   - State 1: Copy button calls navigator.clipboard.writeText
 *   - State 1: "Check again" button calls refetch
 *   - State 2 (empty db): banner renders, not the overlay
 *   - State 2: dismiss button hides the banner
 *   - State 3 (has data): renders null
 *   - State 3 (loading): renders null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OnboardingScreen } from './OnboardingScreen'

// ── Mock framer-motion ────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => true,
}))

// ── Mock useCastStatus ────────────────────────────────────────────────────────
const mockRefetch = vi.fn()

vi.mock('../api/useCastStatus', () => ({
  useCastStatus: vi.fn(),
}))

import { useCastStatus } from '../api/useCastStatus'

const mockUseCastStatus = vi.mocked(useCastStatus)

beforeEach(() => {
  vi.clearAllMocks()
  // Default: loading state (no data yet)
  mockUseCastStatus.mockReturnValue({
    data: undefined,
    refetch: mockRefetch,
    isLoading: true,
    isError: false,
  } as ReturnType<typeof useCastStatus>)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── State 3: loading ──────────────────────────────────────────────────────────

describe('OnboardingScreen — loading state', () => {
  it('renders null when data is undefined', () => {
    const { container } = render(<OnboardingScreen />)
    expect(container.firstChild).toBeNull()
  })
})

// ── State 3: has data ─────────────────────────────────────────────────────────

describe('OnboardingScreen — has data state', () => {
  it('renders null when dbHasData is true', () => {
    mockUseCastStatus.mockReturnValue({
      data: { castInstalled: true, dbExists: true, dbHasData: true, dbPath: '/home/.claude/cast.db' },
      refetch: mockRefetch,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCastStatus>)

    const { container } = render(<OnboardingScreen />)
    expect(container.firstChild).toBeNull()
  })
})

// ── State 1: no db ────────────────────────────────────────────────────────────

describe('OnboardingScreen — no CAST installed', () => {
  beforeEach(() => {
    mockUseCastStatus.mockReturnValue({
      data: { castInstalled: false, dbExists: false, dbHasData: false, dbPath: '/home/.claude/cast.db' },
      refetch: mockRefetch,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCastStatus>)
  })

  it('renders the full-screen overlay', () => {
    render(<OnboardingScreen />)
    expect(screen.getByTestId('onboarding-overlay')).toBeInTheDocument()
  })

  it('renders the welcome heading', () => {
    render(<OnboardingScreen />)
    expect(screen.getByRole('heading', { name: /welcome to cast desktop/i })).toBeInTheDocument()
  })

  it('renders the install command', () => {
    render(<OnboardingScreen />)
    expect(screen.getByText(/curl -fsSL/)).toBeInTheDocument()
  })

  it('Copy button calls navigator.clipboard.writeText with the install command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    render(<OnboardingScreen />)
    fireEvent.click(screen.getByRole('button', { name: /copy install command/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('curl -fsSL')
      )
    })
  })

  it('"Check again" button calls refetch', () => {
    render(<OnboardingScreen />)
    fireEvent.click(screen.getByRole('button', { name: /check again/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('has correct dialog role and aria-modal', () => {
    render(<OnboardingScreen />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'onboarding-heading')
  })
})

// ── State 2: empty db ─────────────────────────────────────────────────────────

describe('OnboardingScreen — CAST installed, empty DB', () => {
  beforeEach(() => {
    mockUseCastStatus.mockReturnValue({
      data: { castInstalled: true, dbExists: true, dbHasData: false, dbPath: '/home/.claude/cast.db' },
      refetch: mockRefetch,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCastStatus>)
  })

  it('renders the banner (not the full overlay)', () => {
    render(<OnboardingScreen />)
    expect(screen.getByTestId('onboarding-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('onboarding-overlay')).toBeNull()
  })

  it('banner contains CAST detected message', () => {
    render(<OnboardingScreen />)
    expect(screen.getByText(/CAST detected/)).toBeInTheDocument()
  })

  it('dismiss button hides the banner', () => {
    render(<OnboardingScreen />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss onboarding banner/i }))
    expect(screen.queryByTestId('onboarding-banner')).toBeNull()
  })

  it('banner has a "Learn more" link to CAST repo', () => {
    render(<OnboardingScreen />)
    const link = screen.getByRole('link', { name: /view cast on github/i })
    expect(link).toHaveAttribute('href', 'https://github.com/ek33450505/claude-agent-team')
  })
})
