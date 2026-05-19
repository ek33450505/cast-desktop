import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentStatusBadge } from './AgentStatusBadge'

describe('AgentStatusBadge — known statuses', () => {
  it('renders DONE with correct aria-label', () => {
    render(<AgentStatusBadge status="DONE" />)
    expect(screen.getByRole('img', { name: 'Status: Done' })).toBeInTheDocument()
  })

  it('renders DONE_WITH_CONCERNS with correct aria-label', () => {
    render(<AgentStatusBadge status="DONE_WITH_CONCERNS" />)
    expect(screen.getByRole('img', { name: 'Status: Done with concerns' })).toBeInTheDocument()
  })

  it('renders BLOCKED with correct aria-label', () => {
    render(<AgentStatusBadge status="BLOCKED" />)
    expect(screen.getByRole('img', { name: 'Status: Blocked' })).toBeInTheDocument()
  })

  it('renders NEEDS_CONTEXT with correct aria-label', () => {
    render(<AgentStatusBadge status="NEEDS_CONTEXT" />)
    expect(screen.getByRole('img', { name: 'Status: Needs context' })).toBeInTheDocument()
  })

  it('renders IN_PROGRESS with correct aria-label', () => {
    render(<AgentStatusBadge status="IN_PROGRESS" />)
    expect(screen.getByRole('img', { name: 'Status: In progress' })).toBeInTheDocument()
  })

  it('renders RUNNING with correct aria-label', () => {
    render(<AgentStatusBadge status="RUNNING" />)
    expect(screen.getByRole('img', { name: 'Status: Running' })).toBeInTheDocument()
  })
})

describe('AgentStatusBadge — unknown status fallback', () => {
  it('renders unknown status with generic aria-label', () => {
    render(<AgentStatusBadge status="SOMETHING_CUSTOM" />)
    expect(screen.getByRole('img', { name: 'Status: SOMETHING_CUSTOM' })).toBeInTheDocument()
  })

  it('displays the unknown status text', () => {
    render(<AgentStatusBadge status="MYSTERY" />)
    // The visible text span (aria-hidden) contains the status
    const badge = screen.getByRole('img', { name: 'Status: MYSTERY' })
    expect(badge.textContent).toContain('MYSTERY')
  })
})

describe('AgentStatusBadge — className prop', () => {
  it('applies custom className to wrapper', () => {
    const { container } = render(<AgentStatusBadge status="DONE" className="my-custom" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('my-custom')
  })
})
