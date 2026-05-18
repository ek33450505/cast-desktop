import { Router } from 'express'
import { withTable } from '../utils/dbHelpers.js'

export const agentTruncationsRouter = Router()

export interface AgentTruncation {
  id: number
  session_id: string | null
  agent_type: string
  agent_id: string | null
  last_line: string | null
  timestamp: string
  char_count: number | null
  has_status: number | null
  has_json: number | null
}

agentTruncationsRouter.get('/', (_req, res) => {
  try {
    const truncations = withTable('agent_truncations', [], (db) =>
      db.prepare(
        'SELECT id, session_id, agent_type, agent_id, last_line, timestamp, char_count, has_status, has_json FROM agent_truncations ORDER BY timestamp DESC LIMIT 50'
      ).all()
    )
    return res.json({ truncations })
  } catch (err) {
    console.error('[agent-truncations] error:', err)
    return res.json({ truncations: [] })
  }
})
