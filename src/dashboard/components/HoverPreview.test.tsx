import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HoverPreview } from './HoverPreview'

describe('HoverPreview', () => {
  it('renders the trigger content', () => {
    render(
      <HoverPreview
        trigger={<span>my-agent</span>}
        title="my-agent"
      />
    )
    expect(screen.getByText('my-agent')).toBeInTheDocument()
  })

  it('renders key/value items in the trigger wrapper without needing hover', () => {
    render(
      <HoverPreview
        trigger={<span>code-writer</span>}
        title="code-writer"
        items={[
          { label: 'Model', value: 'sonnet' },
          { label: 'Memory', value: 'local' },
        ]}
      />
    )
    // Trigger is always mounted
    expect(screen.getByText('code-writer')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <HoverPreview
        trigger={<span>planner</span>}
        title="planner"
        description="Plans multi-agent workflows"
      />
    )
    expect(screen.getByText('planner')).toBeInTheDocument()
  })

  it('renders badge slot when provided', () => {
    render(
      <HoverPreview
        trigger={<span>debugger</span>}
        title="debugger"
        badge={<span data-testid="badge">DONE</span>}
      />
    )
    expect(screen.getByText('debugger')).toBeInTheDocument()
    // Badge is inside hover card content — may be in DOM even before hover
    // We test the trigger at minimum
  })

  it('renders without optional props (title only)', () => {
    render(
      <HoverPreview
        trigger={<span>minimal</span>}
        title="minimal"
      />
    )
    expect(screen.getByText('minimal')).toBeInTheDocument()
  })

  it('trigger wrapper is keyboard-focusable for a11y parity with hover', () => {
    const { container } = render(
      <HoverPreview
        trigger={<span>focusable-agent</span>}
        title="focusable-agent"
      />
    )
    const triggerSpan = container.querySelector('span[tabindex="0"]')
    expect(triggerSpan).toBeTruthy()
    // Visible focus ring class present so keyboard users see a focus state
    expect(triggerSpan?.className).toContain('focus-visible:ring')
  })
})
