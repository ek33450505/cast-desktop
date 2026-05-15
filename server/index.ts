import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'
import { PORT, DASHBOARD_COMMANDS_DIR } from './constants.js'
import { router } from './routes/index.js'
import { attachSSE } from './watchers/sse.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin)
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
app.use(express.static(path.join(__dirname, '../dist')))

app.use('/api/seed', controlLimiter)
app.use('/api/control', destructiveLimiter)
app.use('/api/castd', controlLimiter)
app.use('/api/swarm', controlLimiter)
app.use('/api/constellation', controlLimiter)
// IDE-5: agent dispatch is user-initiated but spawns real processes — moderate limit
app.use('/api/dispatch', destructiveLimiter)

app.use('/api', router)
attachSSE(app)

// SPA fallback — must be after all /api route mounts
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// Global error handler — must be last middleware
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  const status = (err as { status?: number }).status ?? 500
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}: ${message}`)
  if (!res.headersSent) {
    res.status(status).json({ error: message })
  }
})

// Bind to loopback only — the API exposes local CAST observability and must
// never be reachable from LAN/Wi-Fi peers. Combined with the Host-header guard
// above, this defeats both naive remote access and DNS-rebinding attempts.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Claude Dashboard server on :${PORT}`)

  // Non-blocking auto-seed on startup: backfill tokens without user action.
  // Fire-and-forget — never delays the process start.
  setImmediate(() => {
    fetch(`http://localhost:${PORT}/api/cast/seed`, { method: 'POST' })
      .then(r => r.json())
      .then(body => {
        if (process.env.DEBUG) console.debug('[auto-seed]', JSON.stringify(body))
      })
      .catch(err => console.error('[auto-seed] failed:', err))
  })
})
