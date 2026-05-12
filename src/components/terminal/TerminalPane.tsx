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
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!terminal.supported || !containerRef.current || !tab) return

    const xterm = new Terminal({
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#070A0F',
        foreground: '#E6E8EE',
        cursor: '#00FFC2',
        cursorAccent: '#070A0F',
        black: '#1A1E26',
        red: '#FF5F6D',
        green: '#00FFC2',
        yellow: '#FFD166',
        blue: '#5BC0F8',
        magenta: '#C084FC',
        cyan: '#00E5CC',
        white: '#E6E8EE',
        brightBlack: '#3D4455',
        brightRed: '#FF7A84',
        brightGreen: '#33FFD4',
        brightYellow: '#FFE08A',
        brightBlue: '#7DCFFF',
        brightMagenta: '#D4A8FF',
        brightCyan: '#33EBDC',
        brightWhite: '#FFFFFF',
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
            const ptyId = await terminal.create({ shell, cols, rows })

            if (!isMounted) {
              await terminal.kill(ptyId).catch(() => {})
              return
            }

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
