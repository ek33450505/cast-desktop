import { Router } from 'express'
import { getCastDb, getCastDbWritable } from './castDb.js'

export const budgetStatusRouter = Router()

// GET /api/budget/status
budgetStatusRouter.get('/status', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ today_spend: 0, daily_limit: null, pct_used: null, over_budget: false })

    const today = new Date().toISOString().slice(0, 10)
    const spendRow = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) AS spend
      FROM agent_runs WHERE date(started_at) = ?
    `).get(today) as { spend: number }
    const today_spend = spendRow?.spend ?? 0

    // Guard against missing budgets table: return null limits rather than 500
    let budgetRow: { limit_usd: number; alert_at_pct: number } | undefined
    try {
      budgetRow = db.prepare(`
        SELECT limit_usd, alert_at_pct FROM budgets
        WHERE scope = 'global' AND scope_key = 'global' AND period = 'daily'
        ORDER BY id DESC LIMIT 1
      `).get() as { limit_usd: number; alert_at_pct: number } | undefined
    } catch {
      // budgets table does not exist yet — no budget configured
      budgetRow = undefined
    }

    if (!budgetRow) {
      return res.json({ today_spend, daily_limit: null, pct_used: null, over_budget: false })
    }

    const daily_limit = budgetRow.limit_usd
    const pct_used = daily_limit > 0 ? Math.round((today_spend / daily_limit) * 1000) / 10 : null
    const over_budget = daily_limit > 0 && today_spend > daily_limit

    const alert_at_pct = budgetRow.alert_at_pct ?? 0.80
    res.json({ today_spend, daily_limit, pct_used, over_budget, alert_at_pct })
  } catch (err) {
    console.error('Budget status error:', err)
    res.status(500).json({ error: 'Failed to fetch budget status' })
  }
})

// POST /api/budget/config
budgetStatusRouter.post('/config', (req, res) => {
  const { daily_limit_usd, alert_at_pct } = req.body as { daily_limit_usd?: unknown; alert_at_pct?: unknown }

  if (typeof daily_limit_usd !== 'number' || daily_limit_usd < 0) {
    return res.status(400).json({ error: 'daily_limit_usd must be a non-negative number' })
  }
  const alertPct = typeof alert_at_pct === 'number' && alert_at_pct >= 0 && alert_at_pct <= 1
    ? alert_at_pct
    : 0.80  // default

  const db = getCastDbWritable()
  if (!db) return res.status(503).json({ error: 'Database unavailable' })

  try {
    const now = new Date().toISOString()
    // Upsert: delete existing global daily budget then insert fresh row
    db.prepare(`DELETE FROM budgets WHERE scope = 'global' AND scope_key = 'global' AND period = 'daily'`).run()
    db.prepare(`
      INSERT INTO budgets (scope, scope_key, period, limit_usd, alert_at_pct, created_at)
      VALUES ('global', 'global', 'daily', ?, ?, ?)
    `).run(daily_limit_usd, alertPct, now)

    res.json({ ok: true, daily_limit_usd })
  } catch (err) {
    console.error('Budget config write error:', err)
    res.status(500).json({ error: 'Failed to save budget config' })
  } finally {
    db.close()
  }
})
