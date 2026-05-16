import { Router } from 'express'
import type { Request, Response } from 'express'
import { getCastDb } from './castDb.js'

export const agentHallucinationsRouter = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HallucinationRow {
  id: number
  session_id: string | null
  agent_name: string
  claim_type: string
  claimed_value: string | null
  actual_value: string | null
  verified: number
  timestamp: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VERIFIED_ALLOWED = new Set(['0', '1', 'true', 'false'])

// ── Helper: check table existence ─────────────────────────────────────────────

function hallucinationsTableExists(): boolean {
  const db = getCastDb()
  if (!db) return false
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_hallucinations'`
  ).get() as { name: string } | undefined
  return !!row
}

// ── GET /api/agent-hallucinations ─────────────────────────────────────────────

agentHallucinationsRouter.get('/', (req: Request, res: Response) => {
  const { agent, claim_type, verified, date_from, date_to, limit: limitStr, offset: offsetStr } = req.query

  // Validate date params — return 400 for malformed dates
  if (date_from !== undefined && !DATE_RE.test(String(date_from))) {
    res.status(400).json({ error: 'Invalid date_from format. Expected YYYY-MM-DD.' })
    return
  }
  if (date_to !== undefined && !DATE_RE.test(String(date_to))) {
    res.status(400).json({ error: 'Invalid date_to format. Expected YYYY-MM-DD.' })
    return
  }

  // Coerce verified param — reject unknown values
  let verifiedVal: number | undefined
  if (verified !== undefined) {
    const v = String(verified)
    if (!VERIFIED_ALLOWED.has(v)) {
      res.status(400).json({ error: `Invalid verified value "${v}". Expected one of: 0, 1, true, false.` })
      return
    }
    if (v === '1' || v === 'true') verifiedVal = 1
    else verifiedVal = 0
  }

  // Clamp limit to [1, MAX_LIMIT]
  const limit = Math.min(
    Math.max(1, parseInt(String(limitStr ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT
  )
  const offset = Math.max(0, parseInt(String(offsetStr ?? 0), 10) || 0)

  try {
    const db = getCastDb()
    if (!db || !hallucinationsTableExists()) {
      res.json({ hallucinations: [], total: 0 })
      return
    }

    // Build WHERE clause with parameterized placeholders
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (agent !== undefined) {
      conditions.push('agent_name = ?')
      params.push(String(agent))
    }
    if (claim_type !== undefined) {
      conditions.push('claim_type = ?')
      params.push(String(claim_type))
    }
    if (verifiedVal !== undefined) {
      conditions.push('verified = ?')
      params.push(verifiedVal)
    }
    if (date_from !== undefined) {
      conditions.push('timestamp >= ?')
      params.push(String(date_from))
    }
    if (date_to !== undefined) {
      conditions.push('timestamp <= ?')
      params.push(String(date_to))
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query (same filters, no pagination)
    const total = (db.prepare(`
      SELECT COUNT(*) AS cnt FROM agent_hallucinations ${where}
    `).get(...params) as { cnt: number }).cnt

    // Data query — truncate large text columns at SQL level to cap response size
    const hallucinations = db.prepare(`
      SELECT
        id,
        session_id,
        agent_name,
        claim_type,
        SUBSTR(claimed_value, 1, 500) AS claimed_value,
        SUBSTR(actual_value, 1, 500) AS actual_value,
        verified,
        timestamp
      FROM agent_hallucinations
      ${where}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as HallucinationRow[]

    res.json({ hallucinations, total })
  } catch (err) {
    console.error('AgentHallucinations GET / error:', err)
    res.status(500).json({ error: 'Failed to fetch agent hallucinations' })
  }
})

// ── GET /api/agent-hallucinations/summary ────────────────────────────────────

agentHallucinationsRouter.get('/summary', (_req: Request, res: Response) => {
  try {
    const db = getCastDb()
    if (!db || !hallucinationsTableExists()) {
      res.json({ byAgent: [], total: 0 })
      return
    }

    const byAgent = db.prepare(`
      SELECT
        agent_name,
        COUNT(*) AS total,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN verified = 0 THEN 1 ELSE 0 END) AS unverified
      FROM agent_hallucinations
      GROUP BY agent_name
      ORDER BY total DESC
    `).all() as Array<{
      agent_name: string
      total: number
      verified: number
      unverified: number
    }>

    const total = byAgent.reduce((sum, row) => sum + row.total, 0)

    res.json({ byAgent, total })
  } catch (err) {
    console.error('AgentHallucinations GET /summary error:', err)
    res.status(500).json({ error: 'Failed to fetch agent hallucinations summary' })
  }
})

// ── GET /api/agent-hallucinations/:id ────────────────────────────────────────
// Returns a single full (un-truncated) row for the expand drill-down.
// Must be registered after /summary to avoid swallowing that literal route.

agentHallucinationsRouter.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid id. Expected a positive integer.' })
    return
  }

  try {
    const db = getCastDb()
    if (!db || !hallucinationsTableExists()) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const row = db.prepare(`
      SELECT
        id,
        session_id,
        agent_name,
        claim_type,
        claimed_value,
        actual_value,
        verified,
        timestamp
      FROM agent_hallucinations
      WHERE id = ?
    `).get(id) as HallucinationRow | undefined

    if (!row) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json(row)
  } catch (err) {
    console.error('AgentHallucinations GET /:id error:', err)
    res.status(500).json({ error: 'Failed to fetch agent hallucination detail' })
  }
})
