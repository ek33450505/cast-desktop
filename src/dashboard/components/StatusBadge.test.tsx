import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from './StatusBadge'

// ── Variant defaults ───────────────────────────────────────────────────────────

describe('StatusBadge — variant defaults', () => {
  it('no-writer: renders default text and sr-only title', () => {
    render(<StatusBadge variant="no-writer" />)
    // The role="img" element carries the sr-only title as aria-label
    expect(screen.getByRole('img', { name: 'Table has no writer — data will always be empty' })).toBeInTheDocument()
    // Visible text
    expect(screen.getByText('no writer')).toBeInTheDocument()
  })

  it('deferred: renders default text and sr-only title', () => {
    render(<StatusBadge variant="deferred" />)
    expect(screen.getByRole('img', { name: 'Table is a deferred stub — no writer and no reader' })).toBeInTheDocument()
    expect(screen.getByText('stub')).toBeInTheDocument()
  })

  it('failed: renders default text and sr-only title', () => {
    render(<StatusBadge variant="failed" />)
    expect(screen.getByRole('img', { name: 'Status: failed' })).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('healthy: renders default text and sr-only title', () => {
    render(<StatusBadge variant="healthy" />)
    expect(screen.getByRole('img', { name: 'Status: healthy' })).toBeInTheDocument()
    expect(screen.getByText('ok')).toBeInTheDocument()
  })

  it('warning: renders default text and sr-only title', () => {
    render(<StatusBadge variant="warning" />)
    expect(screen.getByRole('img', { name: 'Status: warning' })).toBeInTheDocument()
    expect(screen.getByText('warn')).toBeInTheDocument()
  })
})

// ── Size ───────────────────────────────────────────────────────────────────────

describe('StatusBadge — size prop', () => {
  it("size='md' applies rounded-md class", () => {
    const { container } = render(<StatusBadge variant="healthy" size="md" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('rounded-md')
  })

  it("size='sm' (default) applies rounded class without rounded-md", () => {
    const { container } = render(<StatusBadge variant="healthy" />)
    const badge = container.firstChild as HTMLElement
    // Has 'rounded' but NOT 'rounded-md'
    expect(badge.className).toMatch(/\brounded\b/)
    expect(badge.className).not.toContain('rounded-md')
  })
})

// ── label override ─────────────────────────────────────────────────────────────

describe('StatusBadge — label prop', () => {
  it('label overrides default display text', () => {
    render(<StatusBadge variant="failed" label="broken" />)
    expect(screen.getByText('broken')).toBeInTheDocument()
    // Default text should not be present
    expect(screen.queryByText('failed')).not.toBeInTheDocument()
  })
})

// ── className merging ──────────────────────────────────────────────────────────

describe('StatusBadge — className prop', () => {
  it('custom className is appended to base classes', () => {
    const { container } = render(<StatusBadge variant="healthy" className="my-custom-class" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('my-custom-class')
    // Base color classes should still be present
    expect(badge.className).toContain('emerald')
  })
})

// ── No interactive role ────────────────────────────────────────────────────────

describe('StatusBadge — no interactive role', () => {
  it('renders no button element', () => {
    render(<StatusBadge variant="no-writer" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('has no tabIndex set on the badge span', () => {
    const { container } = render(<StatusBadge variant="warning" />)
    const badge = container.firstChild as HTMLElement
    // tabIndex defaults to -1 or 0 on non-interactive elements; the badge should not explicitly set it
    expect(badge.getAttribute('tabindex')).toBeNull()
  })
})
