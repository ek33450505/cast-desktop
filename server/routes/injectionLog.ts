import { Router } from 'express'
import { withTable } from '../utils/dbHelpers.js'

export const injectionLogRouter = Router()

export interface InjectionLogEntry {
  id: number
  session_id: string | null
  prompt_hash: string
  fact_id: number
  score: number | null
  score_breakdown: string | null
  injected_at: string
}

injectionLogRouter.get('/', (_req, res) => {
  try {
    const entries = withTable('injection_log', [], (db) =>
      db.prepare(
        'SELECT id, session_id, prompt_hash, fact_id, score, injected_at FROM injection_log ORDER BY injected_at DESC LIMIT 100'
      ).all()
    )
    return res.json({ entries })
  } catch (err) {
    console.error('[injection-log] error:', err)
    return res.json({ entries: [] })
  }
})
