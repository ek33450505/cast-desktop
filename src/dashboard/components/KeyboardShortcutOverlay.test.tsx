/**
 * Tests for KeyboardShortcutOverlay.
 *
 * Covers:
 *   - Renders shortcut list when open=true
 *   - Does not render when open=false
 *   - ModalHeader is present with correct title
 *   - Escape calls onClose
 *   - Backdrop click calls onClose
 *   - Close button calls onClose
 *   - Navigation and App shortcut sections are present
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutOverlay } from './KeyboardShortcutOverlay'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('KeyboardShortcutOverlay', () => {
  it('does not render when open=false', () => {
    render(<KeyboardShortcutOverlay open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open=true', () => {
    render(<KeyboardShortcutOverlay open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('renders ModalHeader with title "Keyboard Shortcuts"', () => {
    render(<KeyboardShortcutOverlay open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('renders Navigation shortcuts section', () => {
    render(<KeyboardShortcutOverlay open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Open command palette')).toBeInTheDocument()
    expect(screen.getByText('Open editor')).toBeInTheDocument()
    expect(screen.getByText('Toggle left rail')).toBeInTheDocument()
    expect(screen.getByText('Toggle right rail')).toBeInTheDocument()
  })

  it('renders App shortcuts section', () => {
    render(<KeyboardShortcutOverlay open={true} onClose={vi.fn()} />)
    expect(screen.getByText('App')).toBeInTheDocument()
    expect(screen.getByText('Show shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Close / dismiss')).toBeInTheDocument()
  })

  it('renders keyboard shortcut keys', () => {
    render(<KeyboardShortcutOverlay open={true} onClose={vi.fn()} />)
    expect(screen.getByText('⌘K')).toBeInTheDocument()
    expect(screen.getByText('⌘E')).toBeInTheDocument()
    expect(screen.getByText('⌘B')).toBeInTheDocument()
    expect(screen.getByText('⌘⌥B')).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('Esc')).toBeInTheDocument()
  })

  it('Close button (from ModalHeader) calls onClose', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutOverlay open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutOverlay open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutOverlay open={true} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('shortcuts-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('dialog is labelled by heading', () => {
    render(<KeyboardShortcutOverlay open={true} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const heading = document.getElementById(labelId!)
    expect(heading).toBeTruthy()
  })
})
