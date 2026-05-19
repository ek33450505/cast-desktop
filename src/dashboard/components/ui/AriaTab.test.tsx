import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AriaTabList, AriaTab, AriaTabPanel } from './AriaTab'

// ── Helpers ────────────────────────────────────────────────────────────────────

function TwoTabFixture({
  active,
  onChange,
}: {
  active: 'rows' | 'schema'
  onChange: (t: 'rows' | 'schema') => void
}) {
  return (
    <>
      <AriaTabList aria-label="Table view">
        <AriaTab id="rows" controls="rows-panel" active={active === 'rows'} onSelect={() => onChange('rows')}>
          Rows
        </AriaTab>
        <AriaTab id="schema" controls="schema-panel" active={active === 'schema'} onSelect={() => onChange('schema')}>
          Schema
        </AriaTab>
      </AriaTabList>
      <AriaTabPanel id="rows-panel" labelledBy="rows" hidden={active !== 'rows'}>
        Rows content
      </AriaTabPanel>
      <AriaTabPanel id="schema-panel" labelledBy="schema" hidden={active !== 'schema'}>
        Schema content
      </AriaTabPanel>
    </>
  )
}

// ── AriaTabList ────────────────────────────────────────────────────────────────

describe('AriaTabList', () => {
  it('renders with role="tablist"', () => {
    render(
      <AriaTabList aria-label="Table view">
        <AriaTab id="t1" controls="p1" active={true} onSelect={() => {}}>Tab 1</AriaTab>
      </AriaTabList>
    )
    expect(screen.getByRole('tablist', { name: 'Table view' })).toBeInTheDocument()
  })
})

// ── AriaTab ARIA attributes ────────────────────────────────────────────────────

describe('AriaTab — ARIA attributes', () => {
  it('active tab has aria-selected="true"', () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)
    const rowsTab = screen.getByRole('tab', { name: 'Rows' })
    expect(rowsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('inactive tab has aria-selected="false"', () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)
    const schemaTab = screen.getByRole('tab', { name: 'Schema' })
    expect(schemaTab).toHaveAttribute('aria-selected', 'false')
  })

  it('active tab has tabIndex=0', () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)
    const rowsTab = screen.getByRole('tab', { name: 'Rows' })
    expect(rowsTab).toHaveAttribute('tabindex', '0')
  })

  it('inactive tab has tabIndex=-1', () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)
    const schemaTab = screen.getByRole('tab', { name: 'Schema' })
    expect(schemaTab).toHaveAttribute('tabindex', '-1')
  })

  it('tab has aria-controls pointing to panel', () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)
    const rowsTab = screen.getByRole('tab', { name: 'Rows' })
    expect(rowsTab).toHaveAttribute('aria-controls', 'rows-panel')
  })
})

// ── AriaTabPanel ───────────────────────────────────────────────────────────────

describe('AriaTabPanel', () => {
  it('has role="tabpanel"', () => {
    render(
      <AriaTabPanel id="p1" labelledBy="t1">Content</AriaTabPanel>
    )
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })

  it('is hidden when hidden prop is true', () => {
    const { container } = render(
      <AriaTabPanel id="p1" labelledBy="t1" hidden>Hidden content</AriaTabPanel>
    )
    const panel = container.querySelector('[role="tabpanel"]') as HTMLElement
    expect(panel).toHaveAttribute('hidden')
  })

  it('aria-labelledby matches the tab id', () => {
    render(
      <AriaTabPanel id="rows-panel" labelledBy="rows">Content</AriaTabPanel>
    )
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'rows')
  })
})

// ── Keyboard navigation ────────────────────────────────────────────────────────

describe('AriaTab — keyboard navigation', () => {
  it('ArrowRight moves from first to second tab', async () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)

    const rowsTab = screen.getByRole('tab', { name: 'Rows' })
    rowsTab.focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith('schema')
  })

  it('ArrowRight wraps from last to first tab', async () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="schema" onChange={onChange} />)

    const schemaTab = screen.getByRole('tab', { name: 'Schema' })
    schemaTab.focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith('rows')
  })

  it('ArrowLeft moves from second to first tab', async () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="schema" onChange={onChange} />)

    const schemaTab = screen.getByRole('tab', { name: 'Schema' })
    schemaTab.focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(onChange).toHaveBeenCalledWith('rows')
  })

  it('ArrowLeft wraps from first to last tab', async () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)

    const rowsTab = screen.getByRole('tab', { name: 'Rows' })
    rowsTab.focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(onChange).toHaveBeenCalledWith('schema')
  })

  it('Home key activates first tab', async () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="schema" onChange={onChange} />)

    const schemaTab = screen.getByRole('tab', { name: 'Schema' })
    schemaTab.focus()
    await userEvent.keyboard('{Home}')

    expect(onChange).toHaveBeenCalledWith('rows')
  })

  it('End key activates last tab', async () => {
    const onChange = vi.fn()
    render(<TwoTabFixture active="rows" onChange={onChange} />)

    const rowsTab = screen.getByRole('tab', { name: 'Rows' })
    rowsTab.focus()
    await userEvent.keyboard('{End}')

    expect(onChange).toHaveBeenCalledWith('schema')
  })
})

// ── aria-selected update ───────────────────────────────────────────────────────

describe('AriaTab — aria-selected updates after activation', () => {
  it('aria-selected reflects which tab is active', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TwoTabFixture active="rows" onChange={onChange} />)

    // Initially rows is selected
    expect(screen.getByRole('tab', { name: 'Rows' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Schema' })).toHaveAttribute('aria-selected', 'false')

    // After switching to schema
    rerender(<TwoTabFixture active="schema" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'Rows' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Schema' })).toHaveAttribute('aria-selected', 'true')
  })
})
