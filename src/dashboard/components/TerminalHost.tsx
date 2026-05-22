/**
 * TerminalHost — persistent-container portal pattern.
 *
 * Problem: TerminalTabs was mounted in both ShellLayout (at /) and
 * EditorShellLayout (at /editor). Each layout mount/unmount cycled the xterm
 * instances and spawned duplicate PTYs.
 *
 * Solution: render ONE <TerminalTabs/> into a stable DOM container that is
 * physically re-parented (via appendChild) between layout slots as the user
 * navigates. React's portal keeps the component subtree alive — no unmount,
 * no PTY re-spawn, scrollback preserved.
 *
 * Usage:
 *  1. Wrap the app in <TerminalHostProvider> (must enclose ALL routes that
 *     need terminal access).
 *  2. Place <TerminalSlot/> in any layout that wants to host the terminal pane.
 *     appendChild moves the stable container into the slot before paint.
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { TerminalTabs } from '../../components/terminal/TerminalTabs'
import ErrorBoundary from './ErrorBoundary'

// ── Context ───────────────────────────────────────────────────────────────────

const TerminalHostContext = createContext<HTMLDivElement | null>(null)

// ── TerminalHostProvider ──────────────────────────────────────────────────────

interface TerminalHostProviderProps {
  children: ReactNode
}

export function TerminalHostProvider({ children }: TerminalHostProviderProps) {
  // Stable container created once and never destroyed while the provider lives.
  const [container] = useState<HTMLDivElement>(() => {
    const el = document.createElement('div')
    el.style.width = '100%'
    el.style.height = '100%'
    return el
  })

  return (
    <TerminalHostContext.Provider value={container}>
      {children}
      {createPortal(
        <ErrorBoundary>
          <TerminalTabs />
        </ErrorBoundary>,
        container,
      )}
    </TerminalHostContext.Provider>
  )
}

// ── TerminalSlot ──────────────────────────────────────────────────────────────

interface TerminalSlotProps {
  style?: React.CSSProperties
}

/**
 * TerminalSlot — a placeholder div that "claims" the shared terminal container
 * by appending it as a child. useLayoutEffect runs before paint so there is
 * no flicker between route changes.
 *
 * When this slot mounts (or the container reference changes) the container is
 * moved here. When it unmounts (route change) the container is NOT destroyed —
 * it floats detached until the next slot mounts and claims it.
 */
export function TerminalSlot({ style }: TerminalSlotProps) {
  const container = useContext(TerminalHostContext)
  const slotRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (slotRef.current && container) {
      slotRef.current.appendChild(container)
    }
    // No cleanup — we intentionally let the container float detached between
    // route changes rather than removing it (which would kill the xterm subtree).
  }, [container])

  return (
    <div
      ref={slotRef}
      style={{ width: '100%', height: '100%', ...style }}
    />
  )
}
