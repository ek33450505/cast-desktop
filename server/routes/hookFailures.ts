import { Router } from 'express'
import { withTable } from '../utils/dbHelpers.js'

export interface HookFailureRow {
  id: string
  hook_name: string
  exit_code: number
  stderr: string | null
  session_id: string | null
  timestamp: string
}

export const hookFailuresRouter = Router()

hookFailuresRouter.get('/', (req, res) => {
  try {
    const since = req.query.since as string | undefined
    const conditions: string[] = []
    const params: unknown[] = []
    if (since) { conditions.push('timestamp >= ?'); params.push(since) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const failures = withTable('hook_failures', [] as HookFailureRow[], (db) =>
      db.prepare(`
        SELECT id, hook_name, exit_code, stderr, session_id, timestamp
        FROM hook_failures
        ${where}
        ORDER BY timestamp DESC
        LIMIT 200
      `).all(...params) as HookFailureRow[]
    )

    return res.json({ failures })
  } catch (err) {
    console.error('[hook-failures] error:', err)
    return res.json({ failures: [] })
  }
})

hookFailuresRouter.get('/count', (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const count = withTable('hook_failures', 0, (db) => {
      const row = db.prepare(
        `SELECT COUNT(*) AS cnt FROM hook_failures WHERE timestamp >= ?`
      ).get(since) as { cnt: number }
      return row.cnt ?? 0
    })
    return res.json({ count })
  } catch (err) {
    console.error('[hook-failures/count] error:', err)
    return res.json({ count: 0 })
  }
})
