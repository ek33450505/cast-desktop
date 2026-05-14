import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import type { ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'

import { useTerminal } from '../../hooks/useTerminal'
import { useTerminalStore } from '../../stores/terminalStore'
import { useAppearance, type Appearance } from '../../hooks/useAppearance'
import { createPtyWriteBatcher } from './ptyWriteBatcher'
import type { PtyWriteBatcher } from './ptyWriteBatcher'
import { PasteConfirmBanner } from './PasteConfirmBanner'

// ── Font size constants & helpers ──────────────────────────────────────────────
const FONT_SIZE_KEY = 'cast-terminal-font-size'
const FONT_SIZE_DEFAULT = 13
const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 32

function clampFontSize(size: number): number {
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, size))
}

function readFontSize(): number {
  const stored = localStorage.getItem(FONT_SIZE_KEY)
  if (!stored) return FONT_SIZE_DEFAULT
  const parsed = parseInt(stored, 10)
  return isNaN(parsed) ? FONT_SIZE_DEFAULT : clampFontSize(parsed)
}

function writeFontSize(size: number): number {
  const clamped = clampFontSize(size)
  localStorage.setItem(FONT_SIZE_KEY, String(clamped))
  return clamped
}

// ── Public handle type ─────────────────────────────────────────────────────────
export interface TerminalPaneHandle {
  search: (query: string, opts?: { findNext?: boolean; caseSensitive?: boolean }) => void
  clearSearch: () => void
  clear: () => void
  increaseFontSize: () => void
  decreaseFontSize: () => void
  resetFontSize: () => void
}

/** Pure function — safe to call any time appearance changes */
export function buildTerminalTheme(appearance: Appearance): ITheme {
  const isDawn = appearance === 'dawn'
  return {
    background: isDawn ? '#F7F9F6' : '#1D2622',
    foreground: isDawn ? '#1A211E' : '#E6E8E2',
    cursor:    '#E6A532',
    cursorAccent: isDawn ? '#F7F9F6' : '#1D2622',
    black:     isDawn ? '#1A211E' : '#1A1E26',
    red:       isDawn ? '#C42F1E' : '#E64837',
    green:     isDawn ? '#1F8B4C' : '#3FA968',
    yellow:    isDawn ? '#D86B0F' : '#F09543',
    blue:      isDawn ? '#2065BD' : '#4E91D6',
    magenta:   '#C084FC',
    cyan:      isDawn ? '#0E7C7B' : '#33EBDC',
    white:     isDawn ? '#475048' : '#E6E8E2',
    brightBlack:   isDawn ? '#737B72' : '#3D4455',
    brightRed:     isDawn ? '#E64837' : '#FF7A84',
    brightGreen:   isDawn ? '#3FA968' : '#5FCB85',
    brightYellow:  isDawn ? '#E6A532' : '#F0B441',
    brightBlue:    isDawn ? '#4E91D6' : '#7DCFFF',
    brightMagenta: '#D4A8FF',
    brightCyan:    isDawn ? '#33A9A8' : '#7DEBE8',
    brightWhite:   isDawn ? '#1A211E' : '#FFFFFF',
  }
}

interface PtyOutputPayload {
  session_id: string
  data: string
}

interface TerminalPaneProps {
  tabId: string
  onReady?: (handle: TerminalPaneHandle | null) => void
}

export function TerminalPane({ tabId, onReady }: TerminalPaneProps) {
  const terminal = useTerminal()
  const tab = useTerminalStore((s) => s.tabs.find((t) => t.id === tabId))
  const setTabPtyId = useTerminalStore((s) => s.setTabPtyId)
  const setTabPaneId = useTerminalStore((s) => s.setTabPaneId)
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const fontSizeRef = useRef<number>(FONT_SIZE_DEFAULT)
  // ptyIdRef lets the clipboard handler (registered synchronously at mount)
  // reference the ptyId that is resolved asynchronously after terminal.create().
  const ptyIdRef = useRef<string | null>(null)
  // pendingPasteRef holds multi-line clipboard text intercepted by Cmd+V until
  // the user confirms or cancels via PasteConfirmBanner.
  const pendingPasteRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const [showPasteBanner, setShowPasteBanner] = useState(false)
  const [pendingLineCount, setPendingLineCount] = useState(0)
  const { appearance } = useAppearance()

  // Reactive theme update — runs whenever appearance changes WITHOUT recreating
  // the terminal instance. xterm supports live options.theme assignment.
  useEffect(() => {
    const theme = buildTerminalTheme(appearance)
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme
      // xterm's canvas renderer caches glyphs in a texture atlas keyed on the OLD
      // theme colors; without invalidating it, refresh() repaints with stale glyphs.
      xtermRef.current.clearTextureAtlas()
      xtermRef.current.refresh(0, xtermRef.current.rows - 1)
    }
    // Restyle the container element directly — the xterm wrapper background is set
    // at .open() time and doesn't re-render when only options.theme changes
    if (containerRef.current) {
      containerRef.current.style.background = theme.background ?? ''
    }
  }, [appearance])

  useEffect(() => {
    if (!terminal.supported || !containerRef.current || !tab) return

    const initialFontSize = readFontSize()
    fontSizeRef.current = initialFontSize

    const xterm = new Terminal({
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: initialFontSize,
      theme: buildTerminalTheme(appearance),
      cursorBlink: true,
      cursorStyle: 'block',
    })

    xtermRef.current = xterm

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    searchAddonRef.current = searchAddon
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(searchAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.open(containerRef.current)
    // Set container background at mount — the xterm wrapper background is set once
    // at open() time; we mirror it here so the pane shows the correct color before
    // the appearance effect fires on a theme switch.
    containerRef.current.style.background = buildTerminalTheme(appearance).background ?? ''

    // Intercept Cmd+V (paste) so we can show a confirmation banner for multi-line
    // content. Return false to suppress xterm's built-in Cmd+V paste handler.
    xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'v' && event.type === 'keydown') {
        void navigator.clipboard.readText().then((text) => {
          if (!isMountedRef.current || !text) return
          const lines = text.split('\n')
          // Only show confirmation when there are genuinely multiple non-empty lines.
          // A trailing newline alone (lines.length === 2 with last item '') should
          // still go through the banner check via length > 1.
          if (lines.length > 1) {
            pendingPasteRef.current = text
            setPendingLineCount(lines.length)
            setShowPasteBanner(true)
          } else {
            // Single-line: send immediately without a banner
            const currentPtyId = ptyIdRef.current
            if (currentPtyId) {
              void terminal.write(currentPtyId, text)
            }
          }
        }).catch((err) => {
          // Clipboard read can fail (permission denied, browser context).
          // Fall back to letting xterm handle it natively (no-op intercept on error).
          console.warn('[TerminalPane] clipboard.readText failed', err)
        })
        return false  // suppress xterm's default Cmd+V
      }
      return true
    })

    // Build and expose the imperative handle to the parent (TerminalTabs).
    // The parent stores this in a Map keyed by tabId so it can forward
    // search/clear/font-size commands to the currently active pane.
    const handle: TerminalPaneHandle = {
      search: (query, opts) => {
        if (!searchAddonRef.current) return
        if (opts?.findNext === false) {
          searchAddonRef.current.findPrevious(query, { caseSensitive: opts?.caseSensitive ?? false })
        } else {
          searchAddonRef.current.findNext(query, { caseSensitive: opts?.caseSensitive ?? false })
        }
      },
      clearSearch: () => {
        searchAddonRef.current?.clearDecorations()
      },
      clear: () => {
        xtermRef.current?.clear()
      },
      increaseFontSize: () => {
        if (!xtermRef.current) return
        const newSize = writeFontSize(fontSizeRef.current + 1)
        fontSizeRef.current = newSize
        xtermRef.current.options.fontSize = newSize
      },
      decreaseFontSize: () => {
        if (!xtermRef.current) return
        const newSize = writeFontSize(fontSizeRef.current - 1)
        fontSizeRef.current = newSize
        xtermRef.current.options.fontSize = newSize
      },
      resetFontSize: () => {
        if (!xtermRef.current) return
        const newSize = writeFontSize(FONT_SIZE_DEFAULT)
        fontSizeRef.current = newSize
        xtermRef.current.options.fontSize = newSize
      },
    }
    onReady?.(handle)

    let unlistenFn: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null
    isMountedRef.current = true
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let batcher: PtyWriteBatcher | null = null

    const container = containerRef.current

    // Await font loading so xterm's cell-dimension probe uses the correct
    // glyph metrics. Without this, the fallback monospace font is measured
    // and cols/rows will be wrong if the declared font loads a moment later.
    void document.fonts.ready.then(() => {
      if (!isMountedRef.current) return

      requestAnimationFrame(() => {
        if (!isMountedRef.current) return
        fitAddon.fit()
        const { cols, rows } = xterm

        ;(async () => {
          try {
            const shell = await terminal.getDefaultShell()
            const { ptyId, paneId } = await terminal.create({ shell, cols, rows })

            if (!isMountedRef.current) {
              if (ptyId) await terminal.kill(ptyId).catch(() => {})
              return
            }

            // Update store with paneId immediately so TabLabel can start binding
            setTabPaneId(tabId, paneId)

            if (!ptyId) return

            // Store resolved ptyId in ref so the Cmd+V clipboard handler
            // (registered synchronously at mount above) can reference it.
            ptyIdRef.current = ptyId

            // Wire input
            xterm.onData((data) => {
              if (!isMountedRef.current) return
              void terminal.write(ptyId, data)
            })

            // rAF-batched write batcher — coalesces IPC chunks into one xterm.write()
            // per animation frame, preventing partial-paint bleed under burst output.
            batcher = createPtyWriteBatcher((data) => xterm.write(data))

            // Subscribe to output BEFORE first resize so we catch the prompt redraw
            const unlisten = await listen<PtyOutputPayload>(`pty-output-${ptyId}`, (event) => {
              batcher!.push(event.payload.data)
            })

            if (!isMountedRef.current) {
              unlisten()
              return
            }
            unlistenFn = unlisten

            // Update store with real ptyId
            setTabPtyId(tabId, ptyId)

            // Initial resize now that listener is attached
            await terminal.resize(ptyId, cols, rows)
          } catch (err) {
            console.error('[TerminalPane] init failed', err)
          }
        })()
      })
    })

    // ResizeObserver with 150ms debounce (LeftRail toggle animates over 220ms)
    resizeObserver = new ResizeObserver(() => {
      if (!isMountedRef.current) return
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!isMountedRef.current) return
        if (
          !containerRef.current ||
          containerRef.current.offsetWidth === 0 ||
          containerRef.current.offsetHeight === 0
        ) return
        try {
          fitAddon.fit()
          // Invalidate renderer glyph cache after every fit — the canvas renderer
          // caches glyphs keyed on cell dimensions; a resize changes those dimensions,
          // so stale atlas entries cause garbled glyphs until the cache naturally
          // evicts. clearTextureAtlas() forces immediate eviction.
          // Guard: DOM renderer doesn't expose this method; canvas/WebGL addons do.
          if (typeof xterm.clearTextureAtlas === 'function') {
            xterm.clearTextureAtlas()
            xterm.refresh(0, xterm.rows - 1)
          }
          const { cols, rows } = xterm
          const currentPtyId = useTerminalStore.getState().tabs.find((t) => t.id === tabId)?.ptyId
          if (currentPtyId) {
            void terminal.resize(currentPtyId, cols, rows)
          }
        } catch {
          // Terminal may be disposed during cleanup
        }
      }, 150)
    })
    resizeObserver.observe(container)

    return () => {
      isMountedRef.current = false
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      batcher?.dispose()
      if (unlistenFn) unlistenFn()
      resizeObserver?.disconnect()
      xterm.dispose()
      xtermRef.current = null
      searchAddonRef.current = null
      // Clear paste state on unmount — prevents stale pending paste from
      // being replayed if the component remounts for the same tabId.
      ptyIdRef.current = null
      pendingPasteRef.current = null
      // Notify parent that this pane's handle is gone
      onReady?.(null)
      // Do NOT kill the PTY — store owns session lifecycle
    }
    // Only re-mount when tabId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  const confirmPaste = () => {
    const text = pendingPasteRef.current
    const ptyId = ptyIdRef.current
    // Clear first so there's no stale reference if write throws
    pendingPasteRef.current = null
    setShowPasteBanner(false)
    setPendingLineCount(0)
    if (text && ptyId) {
      void terminal.write(ptyId, text)
    }
    // Restore focus to terminal after confirmation
    if (isMountedRef.current) xtermRef.current?.focus()
  }

  const cancelPaste = () => {
    pendingPasteRef.current = null
    setShowPasteBanner(false)
    setPendingLineCount(0)
    // Restore focus to terminal after cancellation
    if (isMountedRef.current) xtermRef.current?.focus()
  }

  if (!terminal.supported) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            Terminal requires the desktop app
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            Open via <code>cargo tauri dev</code> to use the terminal.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label="Terminal"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />
      {showPasteBanner && (
        <PasteConfirmBanner
          lineCount={pendingLineCount}
          onConfirm={confirmPaste}
          onCancel={cancelPaste}
        />
      )}
    </div>
  )
}
