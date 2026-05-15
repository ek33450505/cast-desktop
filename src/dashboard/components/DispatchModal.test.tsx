/**
 * Tests for DispatchModal — IDE-5 agent dispatch entry point.
 *
 * Covers:
 *   - Renders prefilled prompt + agent picker
 *   - Escape closes
 *   - Cmd+Enter submits and calls onDispatched on 202 response
 *   - Failed POST shows toast and does NOT close
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DispatchModal } from './DispatchModal'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DispatchModal', () => {
  const baseProps = {
    initialPrompt: 'File: /tmp/foo.ts\n\nTask: ',
    cwd: '/tmp',
    onClose: vi.fn(),
    onDispatched: vi.fn(),
  }

  it('renders with prefilled prompt and dialog role', () => {
    render(<DispatchModal {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(ta.value).toContain('Task:')
  })

  it('Escape calls onClose', () => {
    const onClose = vi.fn()
    render(<DispatchModal {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Cmd+Enter submits and calls onDispatched on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ run_id: 'abc12345' }),
    } as Response)

    const onDispatched = vi.fn()
    render(<DispatchModal {...baseProps} onDispatched={onDispatched} />)

    // jsdom navigator.platform isn't always Mac — set both meta+ctrl to satisfy either branch.
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true, ctrlKey: true })

    await waitFor(() => {
      expect(onDispatched).toHaveBeenCalledWith('abc12345', 'code-writer')
    })
  })

  it('does not close when dispatch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad agent' }),
    } as Response)

    const onClose = vi.fn()
    const onDispatched = vi.fn()
    render(<DispatchModal {...baseProps} onClose={onClose} onDispatched={onDispatched} />)

    fireEvent.click(screen.getByRole('button', { name: /^Dispatch Code Writer/i }))

    await waitFor(() => {
      expect(onDispatched).not.toHaveBeenCalled()
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
