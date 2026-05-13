import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'

import { useTerminal } from '../../hooks/useTerminal'
import { useTerminalStore } from '../../stores/terminalStore'

interface PtyOutputPayload {
  session_id: string
  data: string
}

interface TerminalPaneProps {
  tabId: string
}

export function TerminalPane({ tabId }: TerminalPaneProps) {
  const terminal = useTerminal()
  const tab = useTerminalStore((s) => s.tabs.find((t) => t.id === tabId))
  const setTabPtyId = useTerminalStore((s) => s.setTabPtyId)
  const setTabPaneId = useTerminalStore((s) => s.setTabPaneId)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!terminal.supported || !containerRef.current || !tab) return

    // Read appearance at terminal init time. xterm's theme is a frozen JS
    // object — it does not react to CSS var changes. Appearance toggles
    // mid-session won't update existing terminals; new tabs pick up the
    // current appearance correctly. Stage 5+ will wire a proper reactive
    // theme that updates on appearance change.
    const isDawn = document.documentElement.getAttribute('data-appearance') === 'dawn'

    const xterm = new Terminal({
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
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
      },
      cursorBlink: true,
      cursorStyle: 'block',
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(searchAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.open(containerRef.current)

    let unlistenFn: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null
    let isMounted = true
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const container = containerRef.current

    // Await font loading so xterm's cell-dimension probe uses the correct
    // glyph metrics. Without this, the fallback monospace font is measured
    // and cols/rows will be wrong if the declared font loads a moment later.
    void document.fonts.ready.then(() => {
      if (!isMounted) return

      requestAnimationFrame(() => {
        if (!isMounted) return
        fitAddon.fit()
        const { cols, rows } = xterm

        ;(async () => {
          try {
            const shell = await terminal.getDefaultShell()
            const { ptyId, paneId } = await terminal.create({ shell, cols, rows })

            if (!isMounted) {
              if (ptyId) await terminal.kill(ptyId).catch(() => {})
              return
            }

            // Update store with paneId immediately so TabLabel can start binding
            setTabPaneId(tabId, paneId)

            if (!ptyId) return

            // Wire input
            xterm.onData((data) => {
              if (!isMounted) return
              void terminal.write(ptyId, data)
            })

            // Subscribe to output BEFORE first resize so we catch the prompt redraw
            const unlisten = await listen<PtyOutputPayload>(`pty-output-${ptyId}`, (event) => {
              xterm.write(event.payload.data)
            })

            if (!isMounted) {
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
      if (!isMounted) return
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!isMounted) return
        if (
          !containerRef.current ||
          containerRef.current.offsetWidth === 0 ||
          containerRef.current.offsetHeight === 0
        ) return
        try {
          fitAddon.fit()
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
      isMounted = false
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      if (unlistenFn) unlistenFn()
      resizeObserver?.disconnect()
      xterm.dispose()
      // Do NOT kill the PTY — store owns session lifecycle
    }
    // Only re-mount when tabId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

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
      ref={containerRef}
      role="application"
      aria-label="Terminal"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  )
}
