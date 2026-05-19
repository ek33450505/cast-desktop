import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { EmptyState } from './EmptyState'

describe('EmptyState — basic rendering', () => {
  it('renders without throwing', () => {
    expect(() => render(<EmptyState icon={FileText} title="No items found" />)).not.toThrow()
  })

  it('renders the title text', () => {
    render(<EmptyState icon={FileText} title="No sessions found" />)
    expect(screen.getByText('No sessions found')).toBeInTheDocument()
  })

  it('renders the message when provided', () => {
    render(<EmptyState icon={FileText} title="No sessions found" message="Run a session to get started." />)
    expect(screen.getByText('Run a session to get started.')).toBeInTheDocument()
  })

  it('does not render message element when omitted', () => {
    render(<EmptyState icon={FileText} title="No sessions found" />)
    expect(screen.queryByText('Run a session to get started.')).not.toBeInTheDocument()
  })
})

describe('EmptyState — icon', () => {
  it('renders an icon element', () => {
    const { container } = render(<EmptyState icon={FileText} title="No files" />)
    // Lucide renders an svg
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('wraps icon in aria-hidden="true" span', () => {
    const { container } = render(<EmptyState icon={FileText} title="No files" />)
    const hiddenSpan = container.querySelector('span[aria-hidden="true"]')
    expect(hiddenSpan).toBeInTheDocument()
    const svg = hiddenSpan?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

describe('EmptyState — action slot', () => {
  it('renders action when provided', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No plans found"
        action={<button>Create plan</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Create plan' })).toBeInTheDocument()
  })

  it('does not render action container when action prop is omitted', () => {
    const { container } = render(<EmptyState icon={FileText} title="No plans found" />)
    // No button element should exist
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // The action wrapper div is only rendered when action is truthy
    const actionDivs = container.querySelectorAll('.mt-1')
    expect(actionDivs.length).toBe(0)
  })

  it('renders arbitrary ReactNode in action slot', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No data"
        action={<a href="/guide">Learn more</a>}
      />
    )
    expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument()
  })
})

describe('EmptyState — className prop', () => {
  it('applies custom className to wrapper', () => {
    const { container } = render(
      <EmptyState icon={FileText} title="No data" className="my-custom-class" />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('my-custom-class')
  })
})
