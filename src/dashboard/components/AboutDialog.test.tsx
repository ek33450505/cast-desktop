/**
 * Tests for AboutDialog — Phase B brand stub.
 *
 * Covers:
 *   - Renders with correct role, tagline, and version
 *   - Escape calls onClose
 *   - Backdrop click calls onClose
 *   - Close button calls onClose
 *   - GitHub link is present and accessible
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AboutDialog } from './AboutDialog'

vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AboutDialog', () => {
  it('renders with dialog role, title, tagline, and version', () => {
    render(<AboutDialog onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Cast Desktop')).toBeInTheDocument()
    expect(screen.getByText(/Your agents, in the room\./)).toBeInTheDocument()
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument()
  })

  it('Close button calls onClose', () => {
    const onClose = vi.fn()
    render(<AboutDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close about dialog/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    render(<AboutDialog onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn()
    render(<AboutDialog onClose={onClose} />)
    fireEvent.click(screen.getByTestId('about-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('GitHub link has correct href and accessible label', () => {
    render(<AboutDialog onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /open cast desktop on github/i })
    expect(link).toHaveAttribute('href', 'https://github.com/ek33450505/cast-desktop')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('dialog is labelled by the heading', () => {
    render(<AboutDialog onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const heading = document.getElementById(labelId!)
    expect(heading).toBeTruthy()
  })
})
