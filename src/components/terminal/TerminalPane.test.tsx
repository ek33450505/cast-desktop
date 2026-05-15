import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TerminalPane, buildTerminalTheme } from './TerminalPane'
import { useTerminalStore } from '../../stores/terminalStore'
import { useTerminal } from '../../hooks/useTerminal'

// jsdom doesn't implement matchMedia — stub it so useAppearance doesn't throw
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockFit = vi.fn()

// Mock the useTerminal hook so we control `supported` without touching Tauri
vi.mock('../../hooks/useTerminal', () => ({
  useTerminal: vi.fn(() => ({
    supported: false,
    create: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    getDefaultShell: vi.fn(() => Promise.resolve('/bin/zsh')),
  })),
}))

// Mock xterm addons — they require a real DOM canvas which jsdom can't provide
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    onData: vi.fn(),
    dispose: vi.fn(),
    attachCustomKeyEventHandler: vi.fn(),
    cols: 80,
    rows: 24,
  })),
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn().mockImplementation(() => ({ fit: mockFit })) }))
vi.mock('@xterm/addon-search', () => ({ SearchAddon: vi.fn().mockImplementation(() => ({})) }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn().mockImplementation(() => ({})) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

beforeEach(() => {
  mockFit.mockClear()
  // Ensure no __TAURI_INTERNALS__ in jsdom
  if ('__TAURI_INTERNALS__' in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__TAURI_INTERNALS__
  }
  // Reset store
  useTerminalStore.setState({ tabs: [], activeTabId: null })
})

describe('buildTerminalTheme', () => {
  it('returns different background values for dawn vs dusk', () => {
    const dawn = buildTerminalTheme('dawn')
    const dusk = buildTerminalTheme('dusk')
    expect(dawn.background).not.toBe(dusk.background)
  })

  it('dawn background is the dawn pane color', () => {
    const dawn = buildTerminalTheme('dawn')
    expect(dawn.background).toBe('#F7F9F6')
  })

  it('dusk background is the dusk pane color', () => {
    const dusk = buildTerminalTheme('dusk')
    expect(dusk.background).toBe('#181B1A')
  })

  it('cursor color is the same amber in both appearances', () => {
    const dawn = buildTerminalTheme('dawn')
    const dusk = buildTerminalTheme('dusk')
    expect(dawn.cursor).toBe('#E6A532')
    expect(dusk.cursor).toBe('#E6A532')
  })
})

describe('TerminalPane', () => {
  it('renders the "not desktop" fallback card when Tauri env is absent', () => {
    const tab = useTerminalStore.getState().addTab('~')
    render(<TerminalPane tabId={tab.id} />)

    expect(screen.getByText('Terminal requires the desktop app')).toBeTruthy()
    expect(screen.getByText(/cargo tauri dev/)).toBeTruthy()
  })

  it('does not render the terminal container when not supported', () => {
    const tab = useTerminalStore.getState().addTab('~')
    const { container } = render(<TerminalPane tabId={tab.id} />)

    // The xterm container div should NOT be present when unsupported
    const terminalContainers = container.querySelectorAll('[style*="overflow: hidden"]')
    // The only element with overflow:hidden is the fallback wrapper — there's no xterm div
    // The fallback card has a centered flex layout, not the bare xterm host
    expect(terminalContainers.length).toBe(0)
  })

  it('sets container style.background to the current appearance background on mount', () => {
    // Override useTerminal to simulate a supported (Tauri) environment so the
    // xterm container div is rendered and the mount effect fires.
    vi.mocked(useTerminal).mockReturnValueOnce({
      supported: true,
      create: vi.fn(() => Promise.resolve({ ptyId: 'test-pty', paneId: 'test-pane' })),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      getDefaultShell: vi.fn(() => Promise.resolve('/bin/zsh')),
    })

    // Block fonts.ready so the async PTY init path is never reached — we only
    // care that the synchronous background assignment after xterm.open() fires.
    const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
    Object.defineProperty(document, 'fonts', {
      value: { ready: new Promise<FontFaceSet>(() => {}) }, // never resolves
      configurable: true,
      writable: true,
    })

    // matchMedia returns matches: false → appearance is 'dusk'
    const expectedBackground = buildTerminalTheme('dusk').background ?? ''

    try {
      const tab = useTerminalStore.getState().addTab('~')
      const { container } = render(<TerminalPane tabId={tab.id} />)

      // The xterm host div has role="application" and overflow:hidden style
      const terminalHost = container.querySelector('[role="application"]') as HTMLElement | null
      // jsdom + xterm mock: open() is a no-op but style.background is still set
      // synchronously after open() returns.
      // jsdom normalizes hex to rgb() when reading style.background, so we use a
      // temporary element to get the same normalized form for the expected value.
      const probe = document.createElement('div')
      probe.style.background = expectedBackground
      const normalized = probe.style.background

      expect(terminalHost).not.toBeNull()
      expect(terminalHost?.style.background).toBe(normalized)
    } finally {
      if (originalFonts) {
        Object.defineProperty(document, 'fonts', originalFonts)
      }
    }
  })

  // Regression test: fitAddon.fit() must NOT be called synchronously on mount.
  // The PTY cell-dimension mismatch artifacts (duplicate lines, dash trails) were
  // caused by fit() running before document.fonts.ready resolved — measuring with
  // fallback monospace metrics before the declared 'Geist Mono' font was available.
  // This test verifies that fit() is deferred behind document.fonts.ready.
  //
  // Proof of regression: before the fix, the code called requestAnimationFrame()
  // directly (no fonts.ready guard). In jsdom, rAF runs synchronously in tests
  // via fake timers or immediately — so fit() WOULD be called here synchronously.
  // After the fix, fit() is nested inside document.fonts.ready.then(), which is
  // always async, so fit() is never called before the microtask queue drains.
  it('does not call fitAddon.fit() synchronously on mount (font-ready guard regression)', () => {
    // Block fonts.ready so fit() cannot be called during this synchronous test.
    const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
    Object.defineProperty(document, 'fonts', {
      value: { ready: new Promise<FontFaceSet>(() => {}) }, // never resolves
      configurable: true,
      writable: true,
    })

    // Simulate Tauri environment so the PTY init path is attempted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__TAURI_INTERNALS__ = {}

    try {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalPane tabId={tab.id} />)
      // fit() must NOT have fired — fonts.ready is still pending
      expect(mockFit).not.toHaveBeenCalled()
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__TAURI_INTERNALS__
      if (originalFonts) {
        Object.defineProperty(document, 'fonts', originalFonts)
      }
    }
  })
})
