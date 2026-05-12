import { Router } from 'express'
import type { Request, Response } from 'express'
import { getCastDb, getCastDbWritable } from './castDb.js'

export const paneBindingsRouter = Router()

// ── Schema ────────────────────────────────────────────────────────────────────

const CREATE_PANE_BINDINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS pane_bindings (
    pane_id      TEXT PRIMARY KEY,
    session_id   TEXT,
    started_at   INTEGER,
    ended_at     INTEGER,
    project_path TEXT
  )
`

function ensurePaneBindingsTable(): void {
  const db = getCastDbWritable()
  if (!db) return
  try {
    db.exec(CREATE_PANE_BINDINGS_TABLE)
  } finally {
    db.close()
  }
}

// Belt-and-suspenders: create table if server boots before any hook has fired
ensurePaneBindingsTable()

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaneBindingRow {
  pane_id: string
  session_id: string | null
  started_at: number | null
  ended_at: number | null
  project_path: string | null
}

interface PaneBindingResponse {
  paneId: string
  sessionId: string | null
  startedAt: number | null
  endedAt: number | null
  projectPath: string | null
}

function rowToResponse(row: PaneBindingRow): PaneBindingResponse {
  return {
    paneId: row.pane_id,
    sessionId: row.session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    projectPath: row.project_path,
  }
}

// ── GET /stream — SSE ─────────────────────────────────────────────────────────
// NOTE: must be registered before /:paneId to avoid route capture

paneBindingsRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // High-water mark: track the highest started_at or ended_at seen across all rows
  let highWaterMark = 0

  function poll(): void {
    try {
      const db = getCastDb()
      if (!db) {
        res.write(':keepalive\n\n')
        return
      }

      let rows: PaneBindingRow[]

      if (highWaterMark === 0) {
        // First poll: seed the client with all existing rows
        const stmt = db.prepare(
          'SELECT pane_id, session_id, project_path, started_at, ended_at FROM pane_bindings'
        )
        rows = stmt.all() as PaneBindingRow[]
      } else {
        // Subsequent polls: only rows newer than the high-water mark
        const stmt = db.prepare(
          `SELECT pane_id, session_id, project_path, started_at, ended_at
           FROM pane_bindings
           WHERE started_at > ? OR ended_at > ?`
        )
        rows = stmt.all(highWaterMark, highWaterMark) as PaneBindingRow[]
      }

      for (const row of rows) {
        const newWaterMark = Math.max(
          row.started_at ?? 0,
          row.ended_at ?? 0
        )
        if (newWaterMark > highWaterMark) {
          highWaterMark = newWaterMark
        }

        res.write(
          `data: ${JSON.stringify({
            paneId: row.pane_id,
            sessionId: row.session_id,
            projectPath: row.project_path,
            endedAt: row.ended_at,
          })}\n\n`
        )
      }
    } catch (err) {
      console.error('[pane-bindings/stream] poll error:', err)
    }
  }

  // Initial poll to seed client cache
  poll()

  const pollInterval = setInterval(poll, 2_000)

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n')
  }, 30_000)

  req.on('close', () => {
    clearInterval(pollInterval)
    clearInterval(keepAlive)
  })
})

// ── GET /:paneId — single binding lookup ──────────────────────────────────────

paneBindingsRouter.get('/:paneId', (req: Request, res: Response) => {
  const { paneId } = req.params

  try {
    const db = getCastDb()
    if (!db) {
      res.status(404).json({ error: 'pane binding not found' })
      return
    }

    const stmt = db.prepare(
      'SELECT pane_id, session_id, started_at, ended_at, project_path FROM pane_bindings WHERE pane_id = ?'
    )
    const row = stmt.get(paneId) as PaneBindingRow | undefined

    if (!row) {
      res.status(404).json({ error: 'pane binding not found' })
      return
    }

    res.status(200).json(rowToResponse(row))
  } catch (err) {
    console.error('[pane-bindings] lookup error:', err)
    res.status(500).json({ error: 'failed to query pane binding' })
  }
})
