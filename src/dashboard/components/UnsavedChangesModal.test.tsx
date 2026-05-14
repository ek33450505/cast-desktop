import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UnsavedChangesModal } from './UnsavedChangesModal'

// useReducedMotion may throw in jsdom without motion provider; stub it.
vi.mock('framer-motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('framer-motion')>()
  return { ...original, useReducedMotion: () => true }
})

const defaultProps = {
  dirtyPaths: ['/foo/a.ts'],
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  onCancel: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UnsavedChangesModal', () => {
  it('renders the dialog with correct role and aria attributes', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'unsaved-changes-heading')
  })

  it('shows the heading', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument()
  })

  it('names the dirty file in the body text (single file)', () => {
    render(<UnsavedChangesModal {...defaultProps} dirtyPaths={['/foo/a.ts']} />)
    expect(screen.getByText(/a\.ts/)).toBeInTheDocument()
  })

  it('shows count for multiple dirty files', () => {
    render(
      <UnsavedChangesModal
        {...defaultProps}
        dirtyPaths={['/foo/a.ts', '/foo/b.ts']}
      />,
    )
    expect(screen.getByText(/2 files have unsaved changes/i)).toBeInTheDocument()
  })

  it('calls onSave when Save button is clicked', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(defaultProps.onSave).toHaveBeenCalledOnce()
  })

  it('calls onDiscard when "Don\'t Save" button is clicked', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }))
    expect(defaultProps.onDiscard).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape is pressed', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when backdrop is clicked', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    // The backdrop is the outermost div (not the dialog)
    const backdrop = document.querySelector('[style*="fixed"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('all three action buttons have aria-labels', () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /save changes and close/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel.*keep editor open/i })).toBeInTheDocument()
  })
})
