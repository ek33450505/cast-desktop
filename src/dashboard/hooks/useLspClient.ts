/**
 * useLspClient — connects to the TypeScript LSP sidecar via WebSocket and
 * returns a memoized CodeMirror extension for language intelligence.
 *
 * The sidecar exposes typescript-language-server over a local WebSocket.
 * LSP messages are framed with Content-Length headers on the wire; this
 * transport strips incoming headers and adds them on send so that
 * @codemirror/lsp-client receives / sends clean JSON-RPC strings.
 *
 * Graceful failure: if the Tauri command fails or the WS connection fails,
 * returns { extension: null, status: 'error' }. The editor continues working
 * without LSP.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import type { Extension } from '@codemirror/state'
import {
  LSPClient,
  languageServerSupport,
  languageServerExtensions,
} from '@codemirror/lsp-client'
import type { Transport } from '@codemirror/lsp-client'

export type LspStatus = 'connecting' | 'ready' | 'error'

export interface UseLspClientResult {
  extension: Extension | null
  status: LspStatus
  error?: string
}

// ── Content-Length framing helpers ────────────────────────────────────────────
// LSP protocol: messages are framed as:
//   "Content-Length: <N>\r\n\r\n<json>"
// The lsp-client library works with raw JSON strings; we must strip/add framing.

function addContentLength(json: string): string {
  const encoded = new TextEncoder().encode(json)
  return `Content-Length: ${encoded.byteLength}\r\n\r\n${json}`
}

interface StripResult {
  messages: string[]
  remaining: string
}

function stripContentLength(raw: string): StripResult {
  // A single WebSocket frame may carry multiple LSP messages, or a partial one.
  // We return both the parsed messages AND whatever wasn't consumed so the
  // caller doesn't have to re-derive byte offsets from the messages (that
  // re-derivation is fragile against header whitespace variants).
  const messages: string[] = []
  let remaining = raw
  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf('\r\n\r\n')
    if (headerEnd === -1) break
    const header = remaining.slice(0, headerEnd)
    const lenMatch = header.match(/Content-Length:\s*(\d+)/i)
    if (!lenMatch) break
    const len = parseInt(lenMatch[1]!, 10)
    const body = remaining.slice(headerEnd + 4, headerEnd + 4 + len)
    if (body.length < len) break // incomplete — wait for next frame
    messages.push(body)
    remaining = remaining.slice(headerEnd + 4 + len)
  }
  return { messages, remaining }
}

// ── Invoke Tauri command ──────────────────────────────────────────────────────

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLspClient(workspaceRoot: string): UseLspClientResult {
  const [status, setStatus] = useState<LspStatus>('connecting')
  const [error, setError] = useState<string | undefined>(undefined)
  const [extension, setExtension] = useState<Extension | null>(null)

  // Keep refs to avoid stale closures in event handlers
  const wsRef = useRef<WebSocket | null>(null)
  const clientRef = useRef<LSPClient | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let ws: WebSocket | null = null
    let lspClient: LSPClient | null = null

    async function connect() {
      try {
        // Step 1: ask Tauri to start the LSP sidecar, get back its WS port
        let port: number
        try {
          port = await invokeTauri<number>('start_lsp_server')
        } catch (tauriErr) {
          // Not running inside Tauri (browser dev mode) — graceful no-op
          if (!mountedRef.current) return
          console.warn('[useLspClient] Tauri not available:', tauriErr)
          setStatus('error')
          setError('Tauri not available')
          return
        }

        // Step 2: open WebSocket to sidecar
        ws = new WebSocket(`ws://127.0.0.1:${port}/`)
        wsRef.current = ws

        // Accumulate partial incoming data
        let incoming = ''

        const handlers = new Set<(msg: string) => void>()

        const transport: Transport = {
          send(message: string) {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(addContentLength(message))
            }
          },
          subscribe(handler: (msg: string) => void) {
            handlers.add(handler)
          },
          unsubscribe(handler: (msg: string) => void) {
            handlers.delete(handler)
          },
        }

        ws.onmessage = (event: MessageEvent) => {
          const data = typeof event.data === 'string'
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer)
          incoming += data
          const { messages, remaining } = stripContentLength(incoming)
          incoming = remaining
          for (const msg of messages) {
            for (const h of handlers) h(msg)
          }
        }

        ws.onopen = () => {
          if (!mountedRef.current) return

          // Step 3: build and connect LSP client
          const rootUri = workspaceRoot.startsWith('/')
            ? `file://${workspaceRoot}`
            : `file:///${workspaceRoot}`

          // Build LSP client with bundled extensions (diagnostics, hover, completion, signatures)
          // languageServerExtensions() returns the standard bundle as LSPClientExtension objects,
          // which must be passed via the extensions config option — they cannot be placed directly
          // in a CodeMirror extension array.
          lspClient = new LSPClient({ extensions: languageServerExtensions() })
          lspClient.connect(transport)
          clientRef.current = lspClient

          // languageServerSupport returns an Extension that wires this editor view
          // to the LSPClient instance.
          const lspExtension: Extension = languageServerSupport(lspClient, rootUri, 'typescript')

          setExtension(lspExtension)
          setStatus('ready')
          setError(undefined)
        }

        ws.onerror = () => {
          if (!mountedRef.current) return
          setStatus('error')
          setError('WebSocket connection to LSP sidecar failed')
          setExtension(null)
        }

        ws.onclose = () => {
          if (!mountedRef.current) return
          // If we were ready and it closes unexpectedly, degrade to error
          setStatus((prev) => prev === 'ready' ? 'error' : prev)
          setExtension(null)
        }
      } catch (err) {
        if (!mountedRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[useLspClient] connection failed:', msg)
        setStatus('error')
        setError(msg)
        setExtension(null)
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (lspClient) {
        try { lspClient.disconnect() } catch { /* ignore */ }
      }
      if (ws) {
        try { ws.close() } catch { /* ignore */ }
      }
      wsRef.current = null
      clientRef.current = null
    }
  // workspaceRoot intentionally stable — reconnect only if root changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot])

  return useMemo(() => ({ extension, status, error }), [extension, status, error])
}
