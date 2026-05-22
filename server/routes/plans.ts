import { Router } from 'express'
import type { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { loadPlans } from '../parsers/memory.js'
import { PLANS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'
import { getCastDb } from './castDb.js'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlanTask {
  id: string
  text: string
  done: boolean
}

export interface ActivePlanResponse {
  planPath: string | null
  title: string | null
  tasks: PlanTask[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse plan markdown and extract tasks.
 * Prefers `- [ ]` / `- [x]` checkbox lines; falls back to `### Task N:` headers.
 */
export function parsePlanTasks(content: string): PlanTask[] {
  const lines = content.split('\n')

  // Try checkbox lines first
  const checkboxLines = lines.filter(l => /^- \[([ xX])\]/.test(l))
  if (checkboxLines.length > 0) {
    return checkboxLines.map((line, idx) => {
      const match = line.match(/^- \[([ xX])\] (.+)$/)
      if (!match) return null
      const done = match[1].toLowerCase() === 'x'
      const text = match[2].trim()
      return { id: `task-${idx}`, text, done }
    }).filter((t): t is PlanTask => t !== null)
  }

  // Fallback: ### Task N: headers
  const headerLines = lines.filter(l => /^###\s+Task\s+\d+/.test(l))
  if (headerLines.length > 0) {
    return headerLines.map((line, idx) => {
      const text = line.replace(/^###\s+/, '').trim()
      return { id: `task-${idx}`, text, done: false }
    })
  }

  // Fallback: ### N. <text> headers (numbered subsections — common planner format)
  const numberedHeaderLines = lines.filter(l => /^###\s+\d+\.\s+/.test(l))
  if (numberedHeaderLines.length > 0) {
    return numberedHeaderLines.map((line, idx) => {
      const text = line.replace(/^###\s+\d+\.\s+/, '').trim()
      return { id: `task-${idx}`, text, done: false }
    })
  }

  return []
}

/**
 * Find the active plan path for a given session via cast.db agent_runs.
 *
 * Returns null when:
 * - sessionId is absent or null (unbound pane — no global fallback by design)
 * - sessionId is present but no matching DB row exists (session has no plan)
 * - DB lookup fails
 *
 * The previous mtime-based filesystem fallback has been intentionally removed.
 * It caused unbound terminal panes to display the most-recently-touched plan
 * from any Claude session on the machine (cross-session bleed). The /plans page
 * lists all plans explicitly and does not depend on this fallback.
 */
function findActivePlanPath(sessionId?: string | null): string | null {
  if (!sessionId) return null

  try {
    const db = getCastDb()
    if (db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS plan_sessions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          plan_file  TEXT NOT NULL,
          started_at TEXT NOT NULL
        )
      `)
      const row = db.prepare(
        'SELECT plan_file FROM plan_sessions WHERE session_id = ? AND plan_file IS NOT NULL ORDER BY id DESC LIMIT 1'
      ).get(sessionId) as { plan_file: string } | undefined
      if (row?.plan_file && fs.existsSync(row.plan_file)) {
        return row.plan_file
      }
    }
  } catch {
    // DB lookup failed — return null
  }

  return null
}

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const plans = loadPlans()
  res.json(plans)
})

// ── GET /active?sessionId=<id> ────────────────────────────────────────────────
// IMPORTANT: declared before /:filename to avoid route capture

router.get('/active', (req: Request, res: Response) => {
  const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : null

  const planPath = findActivePlanPath(sessionId)
  if (!planPath) {
    const empty: ActivePlanResponse = { planPath: null, title: null, tasks: [] }
    res.json(empty)
    return
  }

  try {
    const content = fs.readFileSync(planPath, 'utf-8')
    const tasks = parsePlanTasks(content)
    const response: ActivePlanResponse = {
      planPath,
      title: path.basename(planPath),
      tasks,
    }
    res.json(response)
  } catch {
    const empty: ActivePlanResponse = { planPath: null, title: null, tasks: [] }
    res.json(empty)
  }
})

// ── GET /:filename ────────────────────────────────────────────────────────────

router.get('/:filename', (req, res) => {
  const filePath = safeResolve(PLANS_DIR, req.params.filename)
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' })
    return
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Plan not found' })
    return
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  const stat = fs.statSync(filePath)

  const plans = loadPlans()
  const meta = plans.find(p => p.filename === req.params.filename)

  res.json({
    filename: req.params.filename,
    title: meta?.title || req.params.filename,
    body: content,
    modifiedAt: stat.mtime.toISOString(),
  })
})

export { router as plansRouter }
