/**
 * Tests for AgentRunStatusPanel — IDE-5.
 *
 * Covers:
 *   - Renders with role="status" and run id short form
 *   - Cancel button issues DELETE and calls onClose
 *   - Polling stops on done status (onClose fires)
 *
 * Note: we use real timers + small POLL_INTERVAL via short waitFor windows
 * rather than fake timers — fake timers + fetch promises tend to deadlock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentRunStatusPanel } from './AgentRunStatusPanel'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AgentRunStatusPanel', () => {
  const baseProps = {
    run_id: 'abcdef1234567890',
    agent: 'code-writer' as const,
    onClose: vi.fn(),
  }

  it('renders with role=status and short run id', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ run_id: baseProps.run_id, status: 'running' }),
    } as Response)

    render(<AgentRunStatusPanel {...baseProps} />)
    const panel = screen.getByRole('status')
    expect(panel).toBeInTheDocument()
    // Short id is first 8 chars
    expect(panel.textContent).toContain('abcdef12')
  })

  it('Cancel button issues DELETE and calls onClose', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ run_id: baseProps.run_id, status: 'running' }),
    } as Response)

    const onClose = vi.fn()
    render(<AgentRunStatusPanel {...baseProps} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
    // At least one fetch call should be the DELETE (the others are polling GETs)
    const calls = vi.mocked(fetch).mock.calls
    const deleteCall = calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE')
    expect(deleteCall).toBeDefined()
  })

  it('closes when status becomes done', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ run_id: baseProps.run_id, status: 'done', files_modified: ['/tmp/foo.ts'] }),
    } as Response)

    const onClose = vi.fn()
    render(<AgentRunStatusPanel {...baseProps} onClose={onClose} />)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    }, { timeout: 4000 })
  })
})
