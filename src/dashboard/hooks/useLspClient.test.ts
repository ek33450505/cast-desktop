/**
 * Tests for useLspClient hook
 *
 * Covers:
 * 1. Happy path — Tauri invoke returns a port, WS connects, hook returns ready + extension
 * 2. Error path — Tauri invoke throws, hook returns error
 * 3. Error path — WS onerror fires, hook returns error
 * 4. Cleanup — hook disconnects on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Hoisted mocks (must be defined before any vi.mock calls) ──────────────────
const { mockInvoke, mockConnect, mockDisconnect, MockLSPClientCls } = vi.hoisted(() => {
  const mockDisconnect = vi.fn()
  const mockConnect = vi.fn()
  const MockLSPClientCls = vi.fn(() => ({ connect: mockConnect, disconnect: mockDisconnect }))
  const mockInvoke = vi.fn()
  return { mockInvoke, mockConnect, mockDisconnect, MockLSPClientCls }
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@codemirror/lsp-client', () => ({
  LSPClient: MockLSPClientCls,
  languageServerSupport: vi.fn((_client, _uri, _lang) => 'MOCK_LSP_EXTENSION'),
  languageServerExtensions: vi.fn(() => []),
}))

// ── WebSocket mock ─────────────────────────────────────────────────────────────

let lastWsInstance: MockWebSocket | null = null

class MockWebSocket {
  static OPEN = 1
  readyState = 0

  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null

  close = vi.fn(() => {
    this.readyState = 3
    this.onclose?.()
  })
  send = vi.fn()

  constructor(public url: string) {
    lastWsInstance = this
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', MockWebSocket)
  lastWsInstance = null
  mockInvoke.mockReset()
  mockConnect.mockReset()
  mockDisconnect.mockReset()
  MockLSPClientCls.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Import after mocks are set up
const { useLspClient } = await import('./useLspClient')

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useLspClient', () => {
  it('starts in connecting status', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useLspClient('/workspace'))
    expect(result.current.status).toBe('connecting')
    expect(result.current.extension).toBeNull()
  })

  it('returns ready status and extension when WS connects', async () => {
    mockInvoke.mockResolvedValue(9999)

    const { result } = renderHook(() => useLspClient('/workspace'))

    await waitFor(() => expect(lastWsInstance).not.toBeNull())

    act(() => {
      lastWsInstance!.simulateOpen()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.extension).toBe('MOCK_LSP_EXTENSION')
    expect(result.current.error).toBeUndefined()
    expect(mockInvoke).toHaveBeenCalledWith('start_lsp_server', undefined)
    expect(mockConnect).toHaveBeenCalled()
  })

  it('returns error status when Tauri invoke throws', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri not available'))

    const { result } = renderHook(() => useLspClient('/workspace'))

    await waitFor(() => expect(result.current.status).toBe('error'))

    expect(result.current.extension).toBeNull()
    expect(result.current.error).toContain('Tauri not available')
  })

  it('returns error status when WebSocket onerror fires', async () => {
    mockInvoke.mockResolvedValue(9998)

    const { result } = renderHook(() => useLspClient('/workspace'))

    await waitFor(() => expect(lastWsInstance).not.toBeNull())

    act(() => {
      lastWsInstance!.simulateError()
    })

    await waitFor(() => expect(result.current.status).toBe('error'))

    expect(result.current.extension).toBeNull()
    expect(result.current.error).toMatch(/WebSocket connection.*failed/)
  })

  it('calls disconnect on unmount', async () => {
    mockInvoke.mockResolvedValue(9997)

    const { result, unmount } = renderHook(() => useLspClient('/workspace'))

    await waitFor(() => expect(lastWsInstance).not.toBeNull())

    act(() => { lastWsInstance!.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    unmount()

    expect(mockDisconnect).toHaveBeenCalled()
    expect(lastWsInstance!.close).toHaveBeenCalled()
  })
})
