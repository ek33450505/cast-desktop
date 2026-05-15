/**
 * /api/lsp/start — dev-mode fallback for the bundled TypeScript LSP sidecar.
 *
 * In a packaged Tauri build the front-end calls the Tauri `start_lsp_server`
 * command, which spawns the bundled binary. In `npm run dev` (Vite-only), the
 * Tauri runtime is not loaded, so invoke() fails. This endpoint provides the
 * same outcome — spawn `cast-lsp-ts-<triple>` directly from the Node side,
 * capture the port it prints, and return it.
 *
 * Idempotent: if the sidecar is already running, returns the cached port.
 * Process is kept alive for the lifetime of the dev server.
 */

import { Router, type Request, type Response } from 'express'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

const router = Router()

interface RunningSidecar {
  port: number
  child: ChildProcess
}

let running: RunningSidecar | null = null

function resolveBinaryPath(): string | null {
  // Match the Tauri externalBin convention — host arch suffix.
  // Currently only macOS arm64 is built; expand as cross-arch sidecars land.
  const candidates = [
    'src-tauri/binaries/cast-lsp-ts-aarch64-apple-darwin',
    'src-tauri/binaries/cast-lsp-ts-x86_64-apple-darwin',
  ]
  for (const rel of candidates) {
    const abs = path.resolve(process.cwd(), rel)
    if (fs.existsSync(abs)) return abs
  }
  return null
}

router.get('/start', async (_req: Request, res: Response) => {
  if (running) {
    res.json({ port: running.port })
    return
  }

  const bin = resolveBinaryPath()
  if (!bin) {
    res.status(503).json({
      error: 'LSP sidecar binary not found. Run `npm run build:lsp-sidecar`.',
    })
    return
  }

  try {
    const child = spawn(bin, [], { stdio: ['ignore', 'pipe', 'pipe'] })

    // Sidecar prints the port to stdout on startup. Wait for the first line.
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for sidecar to print port'))
      }, 5000)

      let buf = ''
      child.stdout?.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8')
        const match = buf.match(/(\d{2,5})/)
        if (match) {
          clearTimeout(timer)
          const p = parseInt(match[1]!, 10)
          if (p > 0 && p < 65536) resolve(p)
          else reject(new Error(`Invalid port: ${match[1]}`))
        }
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        // eslint-disable-next-line no-console
        console.warn('[lsp-sidecar stderr]', chunk.toString('utf8').trim())
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })

      child.on('exit', (code) => {
        clearTimeout(timer)
        running = null
        if (code !== 0) reject(new Error(`Sidecar exited early (${code})`))
      })
    })

    running = { port, child }
    res.json({ port })
  } catch (err) {
    res.status(500).json({ error: `Failed to start LSP sidecar: ${String(err)}` })
  }
})

// Clean shutdown on process exit
process.on('exit', () => {
  if (running) {
    try { running.child.kill('SIGTERM') } catch { /* ignore */ }
  }
})

export { router as lspRouter }
