import { Router } from 'express'
import type { Request, Response } from 'express'
import { getCastDb } from './castDb.js'
import { estimateCost } from '../utils/costEstimate.js'

export const sessionCostRouter = Router()

interface AgentRunCostRow {
  input_tokens: number | null
  output_tokens: number | null
  cache_read_input_tokens: number | null
  cache_creation_input_tokens: number | null
  model: string | null
  started_at: string
}

interface SessionCostResponse {
  totalUsd: number
  burnRatePerMin: number
  projectedFourHourUsd: number
  budgetUsd: number | null
}

function computeSessionCost(sessionId: string): SessionCostResponse {
  const db = getCastDb()
  if (!db) {
    return { totalUsd: 0, burnRatePerMin: 0, projectedFourHourUsd: 0, budgetUsd: null }
  }

  const rows = db.prepare(`
    SELECT input_tokens, output_tokens,
           cache_read_input_tokens, cache_creation_input_tokens,
           model, started_at
    FROM agent_runs
    WHERE session_id = ?
  `).all(sessionId) as AgentRunCostRow[]

  let totalUsd = 0
  for (const row of rows) {
    totalUsd += estimateCost(
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_input_tokens ?? 0,
      row.cache_read_input_tokens ?? 0,
      row.model ?? ''
    )
  }

  // Burn rate: sum cost for rows started in last 5 minutes, divide by 5
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
  const recentRows = rows.filter(r => r.started_at >= fiveMinAgo)
  let recentCost = 0
  for (const row of recentRows) {
    recentCost += estimateCost(
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_input_tokens ?? 0,
      row.cache_read_input_tokens ?? 0,
      row.model ?? ''
    )
  }
  const burnRatePerMin = recentCost / 5

  return {
    totalUsd,
    burnRatePerMin,
    projectedFourHourUsd: burnRatePerMin * 240,
    budgetUsd: null,
  }
}

// ── GET /?sessionId=<id> ──────────────────────────────────────────────────────

sessionCostRouter.get('/', (req: Request, res: Response) => {
  const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : null
  if (!sessionId) {
    res.json({ totalUsd: 0, burnRatePerMin: 0, projectedFourHourUsd: 0, budgetUsd: null })
    return
  }
  try {
    res.json(computeSessionCost(sessionId))
  } catch (err) {
    console.error('Session cost error:', err)
    res.status(500).json({ error: 'Failed to compute session cost' })
  }
})

// ── GET /stream?sessionId=<id> — SSE ─────────────────────────────────────────

sessionCostRouter.get('/stream', (req: Request, res: Response) => {
  const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : null

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let lastTotalUsd = -1

  function poll() {
    try {
      const data = sessionId
        ? computeSessionCost(sessionId)
        : { totalUsd: 0, burnRatePerMin: 0, projectedFourHourUsd: 0, budgetUsd: null }

      if (Math.abs(data.totalUsd - lastTotalUsd) > 1e-6) {
        lastTotalUsd = data.totalUsd
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }
    } catch {
      // DB unavailable — skip this tick
    }
  }

  // Emit initial snapshot immediately
  poll()

  const pollInterval = setInterval(poll, 10_000)

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n')
  }, 30_000)

  const cleanup = () => {
    clearInterval(pollInterval)
    clearInterval(keepAlive)
  }

  req.on('close', cleanup)
  req.on('error', cleanup)
})
