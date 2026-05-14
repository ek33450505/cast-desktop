import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasteConfirmBanner } from './PasteConfirmBanner'

function setup(lineCount = 12) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <PasteConfirmBanner
      lineCount={lineCount}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
  return { onConfirm, onCancel }
}

describe('PasteConfirmBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the line count in the message (plural)', () => {
    setup(12)
    expect(screen.getByText('12', { exact: false })).toBeTruthy()
    expect(screen.getByText(/lines/)).toBeTruthy()
  })

  it('renders "1 line" singular when lineCount is 1', () => {
    setup(1)
    expect(screen.getByText('1', { exact: false })).toBeTruthy()
    // "lines" plural should NOT appear
    const text = document.body.textContent ?? ''
    expect(text).toContain('1 line')
    expect(text).not.toMatch(/\b1 lines\b/)
  })

  it('renders "N lines" plural when lineCount > 1', () => {
    setup(5)
    const text = document.body.textContent ?? ''
    expect(text).toContain('5 lines')
  })

  it('has role="alertdialog"', () => {
    setup()
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('has aria-label="Paste confirmation"', () => {
    setup()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-label', 'Paste confirmation')
  })

  it('Paste button calls onConfirm when clicked', async () => {
    const user = userEvent.setup()
    const { onConfirm } = setup()
    await user.click(screen.getByRole('button', { name: /confirm paste/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Cancel button calls onCancel when clicked', async () => {
    const user = userEvent.setup()
    const { onCancel } = setup()
    await user.click(screen.getByRole('button', { name: /cancel paste/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Esc key calls onCancel', () => {
    const { onCancel } = setup()
    const dialog = screen.getByRole('alertdialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Enter key calls onConfirm', () => {
    const { onConfirm } = setup()
    const dialog = screen.getByRole('alertdialog')
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Paste button has aria-label', () => {
    setup()
    const pasteBtn = screen.getByRole('button', { name: /confirm paste/i })
    expect(pasteBtn).toHaveAttribute('aria-label')
  })

  it('Cancel button has aria-label', () => {
    setup()
    const cancelBtn = screen.getByRole('button', { name: /cancel paste/i })
    expect(cancelBtn).toHaveAttribute('aria-label')
  })
})
