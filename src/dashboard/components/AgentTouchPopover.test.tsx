/**
 * Tests for AgentTouchPopover
 *
 * Covers:
 * 1. Renders with role="dialog" and aria-labelledby
 * 2. Shows "No agent edits recorded yet" when touches is empty
 * 3. Renders touch entries with agent name + time
 * 4. Close button calls onClose
 * 5. Escape key calls onClose
 * 6. Shows close button with aria-label
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentTouchPopover } from './AgentTouchPopover'
import type { FileTouch } from '../hooks/useFileTouches'

const mockTouches: FileTouch[] = [
  {
    agent_name: 'code-writer',
    tool_name: 'write_file',
    ts: '2026-05-14T14:32:00Z',
    run_id: 'abc12345-6789',
    line_range: null,
  },
  {
    agent_name: 'debugger',
    tool_name: null,
    ts: '2026-05-14T10:00:00Z',
    run_id: null,
    line_range: null,
  },
]

function renderPopover(props: Partial<Parameters<typeof AgentTouchPopover>[0]> = {}) {
  const defaultProps = {
    touches: [],
    anchorEl: null,
    filename: 'foo.ts',
    onClose: vi.fn(),
    ...props,
  }
  return render(<AgentTouchPopover {...defaultProps} />)
}

describe('AgentTouchPopover', () => {
  it('renders with role="dialog" and aria-labelledby', () => {
    renderPopover()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
  })

  it('shows title with filename', () => {
    renderPopover({ filename: 'foo.ts' })
    expect(screen.getByText(/Agent touches · foo\.ts/i)).toBeDefined()
  })

  it('shows empty state when no touches', () => {
    renderPopover({ touches: [] })
    expect(screen.getByText(/No agent edits recorded yet/i)).toBeDefined()
  })

  it('renders touch entries with agent name', () => {
    renderPopover({ touches: mockTouches })
    expect(screen.getByText('code-writer')).toBeDefined()
    expect(screen.getByText('debugger')).toBeDefined()
  })

  it('shows truncated run_id', () => {
    renderPopover({ touches: mockTouches })
    // Run ID is truncated to 8 chars: 'abc12345'
    expect(screen.getByText(/run abc12345/i)).toBeDefined()
  })

  it('shows "—" for null run_id', () => {
    renderPopover({ touches: mockTouches })
    expect(screen.getByText(/run —/i)).toBeDefined()
  })

  it('close button has aria-label and calls onClose', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    const closeBtn = screen.getByRole('button', { name: /close agent touch history/i })
    expect(closeBtn).toBeDefined()
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
