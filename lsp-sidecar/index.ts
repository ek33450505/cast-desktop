/**
 * cast-lsp-ts-sidecar — WebSocket ↔ stdio adapter for typescript-language-server.
 *
 * Usage: bunx index.ts   (or compiled binary)
 *
 * Lifecycle:
 *   1. Spawn typescript-language-server as a child process (stdio transport).
 *   2. Start a WebSocket server on a random free port.
 *   3. Print the chosen port to stdout so Tauri can capture it.
 *   4. Pipe WS frames ↔ child stdio (JSON-RPC with Content-Length framing).
 *   5. Clean shutdown on SIGTERM / SIGINT.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:net'
import { statSync } from 'node:fs'
import { WebSocketServer, type WebSocket } from 'ws'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

// ── Locate typescript-language-server binary ──────────────────────────────────
// When compiled with `bun build --compile`, __dirname is the binary's dir.
const __filename = fileURLToPath(import.meta.url)
const __dir = dirname(__filename)

function resolveTsls(): string {
  // Try sibling node_modules (production: compiled binary runs alongside)
  const candidates = [
    resolve(__dir, 'node_modules', '.bin', 'typescript-language-server'),
    resolve(__dir, '..', 'node_modules', '.bin', 'typescript-language-server'),
    // Fallback: PATH lookup
    'typescript-language-server',
  ]
  for (const c of candidates) {
    try {
      statSync(c)
      return c
    } catch { /* try next */ }
  }
  return candidates[candidates.length - 1]!
}

// ── Find a free TCP port ──────────────────────────────────────────────────────
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        server.close()
        reject(new Error('Failed to get free port'))
        return
      }
      const port = addr.port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const tslsBin = resolveTsls()

  // Spawn typescript-language-server in stdio mode
  const child: ChildProcess = spawn(tslsBin, ['--stdio'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env },
  })

  if (!child.stdin || !child.stdout) {
    console.error('[cast-lsp-ts] Failed to open child stdio')
    process.exit(1)
  }

  const port = await getFreePort()

  // Start WS server
  const wss = new WebSocketServer({ host: '127.0.0.1', port })

  wss.on('connection', (ws: WebSocket) => {
    // WS → child stdin: forward each message as raw bytes
    ws.on('message', (data: Buffer | string) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
      child.stdin!.write(buf)
    })

    // child stdout → WS: forward each chunk as a binary frame
    const onChildData = (chunk: Buffer) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk)
      }
    }
    child.stdout!.on('data', onChildData)

    ws.on('close', () => {
      child.stdout!.off('data', onChildData)
    })

    ws.on('error', (err) => {
      console.error('[cast-lsp-ts] WS error:', err.message)
    })
  })

  wss.on('error', (err) => {
    console.error('[cast-lsp-ts] WSS error:', err.message)
    process.exit(1)
  })

  // Signal startup — Tauri reads this line to get the port
  // Format: "CAST_LSP_PORT=<port>" so it's unambiguous
  console.log(`CAST_LSP_PORT=${port}`)

  // ── Shutdown ────────────────────────────────────────────────────────────────
  function shutdown(signal: string) {
    console.error(`[cast-lsp-ts] ${signal} — shutting down`)
    wss.close(() => {
      child.kill('SIGTERM')
      process.exit(0)
    })
    // Force exit if WS server stalls
    setTimeout(() => {
      child.kill('SIGKILL')
      process.exit(1)
    }, 3000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  child.on('exit', (code) => {
    console.error(`[cast-lsp-ts] tsls exited with code ${code}`)
    wss.close()
    process.exit(code ?? 1)
  })
}

main().catch((err) => {
  console.error('[cast-lsp-ts] Fatal:', err)
  process.exit(1)
})
