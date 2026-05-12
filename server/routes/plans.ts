import { Router } from 'express'
import type { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
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

  return []
}

/**
 * Find the newest plan file in PLANS_DIR by mtime.
 * Optionally checks cast.db agent_runs for a plan_path column first.
 */
function findActivePlanPath(sessionId?: string | null): string | null {
  // Try DB lookup if sessionId provided
  if (sessionId) {
    try {
      const db = getCastDb()
      if (db) {
        // Check if plan_path column exists
        const cols = db.prepare("PRAGMA table_info(agent_runs)").all() as { name: string }[]
        const hasPlanPath = cols.some(c => c.name === 'plan_path')
        if (hasPlanPath) {
          const row = db.prepare(
            'SELECT plan_path FROM agent_runs WHERE session_id = ? AND plan_path IS NOT NULL ORDER BY started_at DESC LIMIT 1'
          ).get(sessionId) as { plan_path: string } | undefined
          if (row?.plan_path && fs.existsSync(row.plan_path)) {
            return row.plan_path
          }
        }
      }
    } catch {
      // DB lookup failed — fall through to filesystem
    }
  }

  // Fallback: newest .md in PLANS_DIR
  if (!fs.existsSync(PLANS_DIR)) return null
  const files = fs.readdirSync(PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const full = path.join(PLANS_DIR, f)
      const stat = fs.statSync(full)
      return { full, mtime: stat.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)

  return files[0]?.full ?? null
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

// ── GET /stream?sessionId=<id> — SSE ─────────────────────────────────────────
// IMPORTANT: declared before /:filename to avoid route capture

router.get('/stream', (req: Request, res: Response) => {
  const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : null

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Track the currently-active plan path so we only emit when the right file changes
  let activePlanPath = findActivePlanPath(sessionId)

  function emitUpdate(changedPath: string) {
    // Refresh the active plan path — it may have changed if a new file was written
    activePlanPath = findActivePlanPath(sessionId)

    if (!activePlanPath) return
    // Only emit if the changed file is the active plan
    if (path.resolve(changedPath) !== path.resolve(activePlanPath)) return

    try {
      const content = fs.readFileSync(activePlanPath, 'utf-8')
      const tasks = parsePlanTasks(content)
      res.write(`data: ${JSON.stringify({ event: 'plan-update', tasks })}\n\n`)
    } catch {
      // File unreadable — swallow
    }
  }

  const watcher = chokidar.watch(PLANS_DIR, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
  })

  watcher.on('change', emitUpdate)
  watcher.on('add', (filePath) => {
    // New file added — may become the new active plan
    activePlanPath = findActivePlanPath(sessionId)
    emitUpdate(filePath)
  })

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n')
  }, 30_000)

  const cleanup = () => {
    clearInterval(keepAlive)
    void watcher.close()
  }

  req.on('close', cleanup)
  req.on('error', cleanup)
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
