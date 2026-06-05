import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'
import { PREFERRED_PORT, DASHBOARD_COMMANDS_DIR } from './constants.js'
import type { AddressInfo } from 'net'
import { router } from './routes/index.js'
import { attachSSE } from './watchers/sse.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// In the installed .app, Tauri sets CAST_RESOURCE_DIR to Contents/Resources/.
// The dev fallback uses __dirname (server/) → ../dist (project root dist/).
const distPath = process.env.CAST_RESOURCE_DIR
  ? path.join(process.env.CAST_RESOURCE_DIR, 'dist')
  : path.join(__dirname, '../dist')

// Ensure dashboard commands directory exists before watchers start
fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '5mb' }))

// Defense-in-depth: reject requests whose Host header is not loopback. This
// neutralizes DNS-rebinding attacks even though the server also binds to
// 127.0.0.1 below. Allow undefined Host for unit tests / curl --resolve etc.
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
app.use((req, res, next) => {
  const host = req.headers.host
  if (host) {
    const hostname = host.split(':')[0]
    if (hostname && !ALLOWED_HOSTS.has(hostname)) {
      return res.status(403).json({ error: 'Forbidden host' })
    }
  }
  next()
})

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
app.use((req, res, next) => {
  // In production the WebView origin is http://127.0.0.1:<port> — echo back the
  // request Origin so CORS passes for any loopback origin. The server binds to
  // 127.0.0.1 only, so this is safe. Falls back to the dev default when no
  // Origin header is present (truly same-origin requests don't send one).
  const origin = req.headers.origin ?? allowedOrigin
  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})
app.options(/.*/, (_req, res) => res.sendStatus(204))

const controlLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// Tighter limiter for destructive control endpoints (rollback, dispatch)
const destructiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// Serve built frontend assets (Option C: Express serves dist/ directly)
app.use(express.static(distPath))

app.use('/api/seed', controlLimiter)
app.use('/api/control', destructiveLimiter)
app.use('/api/castd', controlLimiter)
app.use('/api/swarm', controlLimiter)
// IDE-5: agent dispatch is user-initiated but spawns real processes — moderate limit
app.use('/api/dispatch', destructiveLimiter)
app.use('/api/routines', controlLimiter)
app.use('/api/agent-hallucinations', controlLimiter)
app.use('/api/cast-fs', destructiveLimiter)
// Limit the write-only /notify endpoint; the GET /:paneId sibling is polled every 5s
// and must NOT be throttled, so scope this to /notify only.
app.use('/api/pane-bindings/notify', controlLimiter)

app.use('/api', router)
attachSSE(app)

// SPA fallback — must be after all /api route mounts
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Global error handler — must be last middleware
// Known HttpErrors (with a .status field set by route code) surface their message
// to the client; unhandled generic throws are logged server-side only and return
// a generic message so internal details don't leak.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number }).status ?? 500
  const isHttpError = typeof (err as { status?: unknown }).status === 'number'
  const message = isHttpError && err instanceof Error
    ? err.message
    : 'internal server error'
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}:`, err)
  if (!res.headersSent) {
    res.status(status).json({ error: message })
  }
})

// Bind to loopback only — the API exposes local CAST observability and must
// never be reachable from LAN/Wi-Fi peers. Combined with the Host-header guard
// above, this defeats both naive remote access and DNS-rebinding attempts.
// Dynamic port selection: tries PREFERRED_PORT first, falls back to OS-assigned
// port 0 on EADDRINUSE so Cast Desktop starts even when 49301 is taken.
async function startListening(): Promise<void> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const server = app.listen(port, '127.0.0.1')
      server.on('listening', () => {
        const addr = server.address() as AddressInfo
        const actualPort = addr.port
        process.stdout.write(`CAST_SERVER_PORT=${actualPort}\n`)
        console.log(`Cast Desktop server on :${actualPort}`)
        setImmediate(() => {
          fetch(`http://localhost:${actualPort}/api/cast/seed`, { method: 'POST' })
            .then(r => r.json())
            .then(body => {
              if (process.env.DEBUG) console.debug('[auto-seed]', JSON.stringify(body))
            })
            .catch(err => console.error('[auto-seed] failed:', err))
        })
        resolve()
      })
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port !== 0) {
          server.close()
          // In dev mode CAST_SERVER_PORT_OVERRIDE is unset and the Vite proxy is
          // hardcoded to PREFERRED_PORT — a silent fallback to a random port breaks
          // all API calls. Fail fast so the zombie holding the port is obvious.
          if (!process.env.CAST_SERVER_PORT_OVERRIDE) {
            console.error(
              `[cast-server] port ${port} is already in use.\n` +
              `Run: lsof -ti:${port} | xargs kill -9\nthen restart the dev server.`
            )
            process.exit(1)
          }
          console.warn(`[cast-server] port ${port} in use, using OS-assigned port`)
          tryPort(0)
        } else {
          reject(err)
        }
      })
    }
    // In production Tauri passes CAST_SERVER_PORT_OVERRIDE — use it directly.
    // In dev mode (tsx) the env var is unset and we fall back to PREFERRED_PORT.
    const override = process.env.CAST_SERVER_PORT_OVERRIDE
    tryPort(override ? parseInt(override, 10) : PREFERRED_PORT)
  })
}

await startListening()

// Self-exit when Tauri parent closes the pipe (normal quit, SIGKILL, or crash).
// Tauri spawns this sidecar with piped stdin; when the parent process dies the OS
// closes the write-end of the pipe and we receive EOF here. process.exit() is
// called directly because `server` is scoped inside tryPort() and inaccessible
// at module scope — Express drains in-flight requests automatically on exit.
process.stdin.resume()
process.stdin.on('end', () => {
  console.log('[cast-server] stdin EOF — parent exited, shutting down')
  process.exit(0)
})
process.stdin.on('close', () => {
  console.log('[cast-server] stdin closed — parent exited, shutting down')
  process.exit(0)
})
