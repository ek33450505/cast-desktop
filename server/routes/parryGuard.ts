import { Router } from 'express'
import { withTable } from '../utils/dbHelpers.js'

export const parryGuardRouter = Router()

export interface ParryGuardEvent {
  id: number
  tool_name: string
  input_snippet: string | null
  rejected_at: string
}

parryGuardRouter.get('/', (_req, res) => {
  try {
    const events = withTable('parry_guard_events', [], (db) =>
      db.prepare(
        'SELECT id, tool_name, input_snippet, rejected_at FROM parry_guard_events ORDER BY rejected_at DESC LIMIT 50'
      ).all()
    )
    return res.json({ events })
  } catch (err) {
    console.error('[parry-guard] error:', err)
    return res.json({ events: [] })
  }
})
