/**
 * useTerminal — Tauri-env guard + invoke wrappers for PTY operations.
 *
 * When running in a browser (no Tauri), `supported` is false and all
 * terminal operations throw. This lets TerminalPane render a fallback card
 * when opened via `npm run dev` without the Tauri wrapper.
 */

import { invoke } from '@tauri-apps/api/core'

export interface CreateResult {
  ptyId: string | null
  paneId: string
}

export interface UseTerminalApi {
  supported: boolean
  create: (opts: { shell: string; cols: number; rows: number; cwd?: string }) => Promise<CreateResult>
  write: (ptyId: string, data: string) => Promise<void>
  resize: (ptyId: string, cols: number, rows: number) => Promise<void>
  kill: (ptyId: string) => Promise<void>
  getDefaultShell: () => Promise<string>
}

function isSupported(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const NOT_DESKTOP_ERR = 'Terminal requires the desktop app'

export function useTerminal(): UseTerminalApi {
  const supported = isSupported()

  if (!supported) {
    return {
      supported: false,
      create: (_opts) => {
        const paneId = crypto.randomUUID()
        return Promise.resolve({ ptyId: null, paneId })
      },
      write: () => Promise.reject(new Error(NOT_DESKTOP_ERR)),
      resize: () => Promise.reject(new Error(NOT_DESKTOP_ERR)),
      kill: () => Promise.reject(new Error(NOT_DESKTOP_ERR)),
      getDefaultShell: () => Promise.resolve('/bin/zsh'),
    }
  }

  return {
    supported: true,
    create: async ({ shell, cols, rows, cwd }) => {
      const paneId = crypto.randomUUID()
      const ptyId = await invoke<string>('pty_create', {
        shell,
        cols,
        rows,
        cwd: cwd ?? null,
        env: { CAST_DESKTOP_PANE_ID: paneId },
      })
      return { ptyId, paneId }
    },
    write: (ptyId, data) =>
      invoke<void>('pty_write', { sessionId: ptyId, data }),
    resize: (ptyId, cols, rows) =>
      invoke<void>('pty_resize', { sessionId: ptyId, cols, rows }),
    kill: (ptyId) =>
      invoke<void>('pty_kill', { sessionId: ptyId }),
    getDefaultShell: () =>
      invoke<string>('get_default_shell'),
  }
}
