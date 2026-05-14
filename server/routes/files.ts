/**
 * server/routes/files.ts — IDE-3 agent-aware file endpoints
 *
 * GET /api/files/touches?path=<abs>
 *   Returns last 50 agent touches for the given absolute file path.
 *   Returns [] (200) if the file_writes table doesn't exist yet.
 *
 * GET /api/plans/files
 *   Returns the set of file paths referenced by any plan in non-done status.
 *   Polls the ~/.claude/plans/ directory, reads plan markdown bodies,
 *   and extracts absolute paths via regex.
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { getCastDb } from './castDb.js'
import { PLANS_DIR } from '../constants.js'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileTouch {
  agent_name: string
  tool_name: string | null
  ts: string
  run_id: string | null
  line_range: string | null
}

// ── GET /touches?path=<abs> ───────────────────────────────────────────────────

router.get('/touches', (req: Request, res: Response) => {
  const rawPath = req.query['path']

  if (typeof rawPath !== 'string' || !rawPath) {
    res.status(400).json({ error: 'path query parameter is required' })
    return
  }

  // Reject relative paths
  if (!path.isAbsolute(rawPath)) {
    res.status(400).json({ error: 'path must be an absolute path' })
    return
  }

  const db = getCastDb()
  if (!db) {
    res.json([])
    return
  }

  try {
    // Check if file_writes table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='file_writes'"
    ).get() as { name: string } | undefined

    if (!tableCheck) {
      // Table doesn't exist yet (migration in flight) — return empty gracefully
      res.json([])
      return
    }

    const rows = db.prepare(
      'SELECT agent_name, tool_name, ts, run_id, line_range FROM file_writes WHERE file_path = ? ORDER BY ts DESC LIMIT 50'
    ).all(rawPath) as FileTouch[]

    res.json(rows)
  } catch (err) {
    // Any DB error (schema mismatch, corrupted table, etc.) — return empty
    console.error('[files/touches] DB error', err)
    res.json([])
  }
})

// ── Plan file extraction ───────────────────────────────────────────────────────
// Cache to avoid re-reading all plans on every poll
// Exported for test reset only
export let _planFilesCache: Set<string> | null = null
export let _planFilesCacheTs = 0
const PLAN_FILES_CACHE_TTL_MS = 5_000

/** Reset the cache — used only in tests. */
export function _resetPlanFilesCache() {
  _planFilesCache = null
  _planFilesCacheTs = 0
}

/**
 * Extract absolute file paths from plan markdown bodies.
 * Looks for Unix-style absolute paths (/Users/..., /home/..., /etc/...).
 */
function extractAbsolutePaths(content: string): string[] {
  // Match absolute paths that look like file references
  const matches = content.match(/\/[^\s"'`\])<>]+/g) ?? []
  return matches.filter((m) => path.isAbsolute(m))
}

/**
 * Get the set of file paths referenced by any plan in non-done status.
 * A plan is considered non-done if any task checkbox is unchecked (- [ ]).
 * Falls back to including all plans if no checkboxes found.
 */
export function getPlanPendingFiles(): Set<string> {
  const now = Date.now()
  if (_planFilesCache && now - _planFilesCacheTs < PLAN_FILES_CACHE_TTL_MS) {
    return _planFilesCache
  }

  const result = new Set<string>()

  if (!fs.existsSync(PLANS_DIR)) {
    _planFilesCache = result
    _planFilesCacheTs = now
    return result
  }

  try {
    const files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const filePath = path.join(PLANS_DIR, file)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')

        // Determine if plan is "done" — any unchecked checkbox means pending
        const hasCheckboxes = /^- \[[ xX]\]/m.test(content)
        if (hasCheckboxes) {
          const hasUnchecked = /^- \[ \]/m.test(content)
          if (!hasUnchecked) {
            // All tasks done — skip this plan
            continue
          }
        }
        // No checkboxes OR has unchecked tasks — treat as pending
        const paths = extractAbsolutePaths(content)
        for (const p of paths) {
          result.add(p)
        }
      } catch {
        // Skip unreadable plan files
      }
    }
  } catch {
    // PLANS_DIR unreadable — return empty
  }

  _planFilesCache = result
  _planFilesCacheTs = now
  return result
}

// ── GET /plan-pending-files ───────────────────────────────────────────────────
// Mounted at /api/files/plan-pending-files to avoid plansRouter /:filename conflict.
// The frontend hook fetches this endpoint directly.

router.get('/plan-pending-files', (_req: Request, res: Response) => {
  try {
    const paths = getPlanPendingFiles()
    res.json(Array.from(paths))
  } catch (err) {
    console.error('[files/plan-pending-files] error', err)
    res.json([])
  }
})

export { router as filesRouter }
