import { Router } from 'express'
import type { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getCastDb } from './castDb.js'

export const routinesRouter = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutineRow {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  agent: string
  output_dir: string
  enabled: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_output_path: string | null
  created_at: string
}

// ── Security: allowed output directory prefix ─────────────────────────────────

const ALLOWED_OUTPUT_PREFIX = path.resolve(os.homedir(), '.claude', 'routines-output')

/** Returns true only if the resolved path is within the allowed prefix. */
function isPathAllowed(filePath: string): boolean {
  if (!filePath) return false
  // Reject null bytes
  if (filePath.includes('\0')) return false
  // Reject obvious traversal segments before resolving
  if (filePath.includes('..')) return false
  const resolved = path.resolve(filePath)
  return resolved.startsWith(ALLOWED_OUTPUT_PREFIX + path.sep) ||
    resolved === ALLOWED_OUTPUT_PREFIX
}

// ── Helper: check table existence ─────────────────────────────────────────────

function routinesTableExists(): boolean {
  const db = getCastDb()
  if (!db) return false
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='routines'`
  ).get() as { name: string } | undefined
  return !!row
}

// ── GET /api/routines ─────────────────────────────────────────────────────────

routinesRouter.get('/', (_req: Request, res: Response) => {
  try {
    const db = getCastDb()
    if (!db || !routinesTableExists()) {
      res.json({ routines: [] })
      return
    }

    const rows = db.prepare(`
      SELECT
        id,
        name,
        trigger_type,
        trigger_value,
        agent_to_dispatch AS agent,
        output_dir,
        enabled,
        last_run_at,
        last_run_status,
        last_run_output_path,
        created_at
      FROM routines
      ORDER BY name ASC
    `).all() as RoutineRow[]

    res.json({ routines: rows })
  } catch (err) {
    console.error('Routines GET / error:', err)
    res.status(500).json({ error: 'Failed to fetch routines' })
  }
})

// ── GET /api/routines/:id/output ──────────────────────────────────────────────

const MAX_OUTPUT_BYTES = 1_048_576 // 1 MB

routinesRouter.get('/:id/output', (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const db = getCastDb()
    if (!db) {
      res.status(500).json({ error: 'Database unavailable' })
      return
    }

    const row = db.prepare(`
      SELECT id, last_run_output_path
      FROM routines
      WHERE id = ?
      LIMIT 1
    `).get(id) as { id: string; last_run_output_path: string | null } | undefined

    if (!row) {
      res.status(404).json({ error: 'routine_not_found' })
      return
    }

    const outputPath = row.last_run_output_path
    if (!outputPath) {
      res.json({ content: null, reason: 'not_found' })
      return
    }

    // Security: lexical fast-fail before existence check
    if (!isPathAllowed(outputPath)) {
      console.warn(`[SECURITY] routines/:id/output — path rejected by lexical check: ${outputPath}`)
      res.json({ content: null, reason: 'not_found' })
      return
    }

    // Check file existence
    if (!fs.existsSync(outputPath)) {
      res.json({ content: null, reason: 'not_found' })
      return
    }

    // Security: second-layer realpath guard — catches symlinks pointing outside prefix
    let realResolved: string
    try {
      realResolved = fs.realpathSync(outputPath)
    } catch {
      res.json({ content: null, reason: 'not_found' })
      return
    }
    const realPrefix = fs.realpathSync(ALLOWED_OUTPUT_PREFIX)
    if (!realResolved.startsWith(realPrefix + path.sep)) {
      console.warn(`[SECURITY] routines/:id/output — symlink escape detected: ${outputPath} → ${realResolved}`)
      res.json({ content: null, reason: 'not_found' })
      return
    }

    // Size cap: reject files > 1 MB
    const stat = fs.statSync(realResolved)
    if (stat.size > MAX_OUTPUT_BYTES) {
      res.json({ content: null, reason: 'too_large' })
      return
    }

    const content = fs.readFileSync(realResolved, 'utf-8')
    res.json({ content, path: outputPath })
  } catch (err) {
    console.error('Routines GET /:id/output error:', err)
    res.status(500).json({ error: 'Failed to fetch routine output' })
  }
})
