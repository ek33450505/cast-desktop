/**
 * rAF-batched PTY write buffer.
 *
 * xterm.js writes are synchronous per-call. Under high-volume PTY bursts,
 * Tauri fires an IPC event per 4KB chunk — each calls xterm.write() which
 * triggers a partial repaint. Dozens of writes per frame cause visible
 * partial-paint bleed ("Blanching... tStarting in 4s..." artifacts).
 *
 * This module collects chunks in a buffer and flushes them in a single
 * xterm.write() call per animation frame — the canonical VS Code pattern.
 */

export interface PtyWriteBatcher {
  /** Queue a chunk for the next rAF flush. */
  push: (chunk: string) => void
  /** Cancel any pending rAF and discard buffered data. Must be called on unmount. */
  dispose: () => void
}

/**
 * Create a batcher that calls `flushFn` with joined chunks once per animation frame.
 *
 * @param flushFn  Receives the concatenated chunk string. Typically `term.write`.
 * @param schedule Optional override for `requestAnimationFrame` (inject in tests).
 * @param cancel   Optional override for `cancelAnimationFrame` (inject in tests).
 */
export function createPtyWriteBatcher(
  flushFn: (data: string) => void,
  schedule: (cb: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
): PtyWriteBatcher {
  const buffer: string[] = []
  let rafId: number | null = null

  function flush() {
    rafId = null
    if (buffer.length === 0) return
    const data = buffer.join('')
    buffer.length = 0
    flushFn(data)
  }

  return {
    push(chunk: string) {
      buffer.push(chunk)
      if (rafId === null) {
        rafId = schedule(flush)
      }
    },
    dispose() {
      if (rafId !== null) {
        cancel(rafId)
        rafId = null
      }
      buffer.length = 0
    },
  }
}
