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
