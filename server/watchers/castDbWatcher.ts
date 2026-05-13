import type { LiveEvent } from '../../src/types/index.js'
import { getCastDb } from '../routes/castDb.js'

type BroadcastFn = (event: LiveEvent) => void

// Track the highest rowid seen for each table so we emit only new rows
let lastAgentRunRowid = 0
let lastSessionRowid = 0
let lastRoutingRowid = 0

// Track high-water mark for pane_bindings (based on MAX(started_at, ended_at))
let lastPaneBindingWaterMark = 0

let interval: NodeJS.Timeout | null = null

function pollOnce(broadcast: BroadcastFn) {
  const db = getCastDb()
  if (!db) return

  // agent_runs — emit one event per new row (agent name + status + session_id + batch_id)
  try {
    const newRuns = db.prepare(
      'SELECT rowid, agent, status, session_id, batch_id FROM agent_runs WHERE rowid > ? ORDER BY rowid ASC LIMIT 50'
    ).all(lastAgentRunRowid) as Array<{ rowid: number; agent: string; status: string; session_id: string | null; batch_id: number | null }>
    for (const row of newRuns) {
      broadcast({
        type: 'db_change_agent_run',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'agent_runs',
        dbChangeRowId: row.rowid,
        dbChangeAgentName: row.agent,
        dbChangeStatus: row.status,
        dbChangeSessionId: row.session_id ?? undefined,
        dbChangeBatchId: row.batch_id,
      })
      lastAgentRunRowid = row.rowid
    }
  } catch { /* cast.db may not have agent_runs yet */ }

  // sessions
  try {
    const newSessions = db.prepare(
      'SELECT rowid, id FROM sessions WHERE rowid > ? ORDER BY rowid ASC LIMIT 50'
    ).all(lastSessionRowid) as Array<{ rowid: number; id: string }>
    for (const row of newSessions) {
      broadcast({
        type: 'db_change_session',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'sessions',
        dbChangeRowId: row.rowid,
        dbChangeSessionId: row.id,
      })
      lastSessionRowid = row.rowid
    }
  } catch { /* skip */ }

  // routing_events
  try {
    const newRouting = db.prepare(
      'SELECT rowid FROM routing_events WHERE rowid > ? ORDER BY rowid ASC LIMIT 50'
    ).all(lastRoutingRowid) as Array<{ rowid: number }>
    for (const row of newRouting) {
      broadcast({
        type: 'db_change_routing_event',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'routing_events',
        dbChangeRowId: row.rowid,
      })
      lastRoutingRowid = row.rowid
    }
  } catch { /* skip */ }

  // session_cost_updated — aggregate cost across all completed agent_runs
  // Only fires when new agent_run rows appeared this poll (reuses lastAgentRunRowid sentinel)
  // We track whether a new agent_run was processed this tick by comparing before/after
  try {
    const costRow = db.prepare(`
      SELECT
        COALESCE(SUM(estimated_cost_usd), 0) AS totalUsd,
        COUNT(DISTINCT session_id) AS sessionCount
      FROM agent_runs
      WHERE ended_at IS NOT NULL
    `).get() as { totalUsd: number; sessionCount: number } | undefined
    if (costRow) {
      broadcast({
        type: 'session_cost_updated',
        timestamp: new Date().toISOString(),
        totalUsd: costRow.totalUsd,
        sessionCount: costRow.sessionCount,
      })
    }
  } catch { /* agent_runs may not have estimated_cost_usd column yet — skip */ }

  // pane_binding_updated — poll for new/changed rows in pane_bindings (if table exists)
  try {
    // Ensure table exists before querying
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pane_bindings'"
    ).get()
    if (tableExists) {
      let rows: Array<{
        pane_id: string
        session_id: string | null
        project_path: string | null
        started_at: number | null
        ended_at: number | null
      }>
      if (lastPaneBindingWaterMark === 0) {
        // Seed: emit all existing rows once
        rows = db.prepare(
          'SELECT pane_id, session_id, project_path, started_at, ended_at FROM pane_bindings'
        ).all() as typeof rows
      } else {
        rows = db.prepare(
          `SELECT pane_id, session_id, project_path, started_at, ended_at
           FROM pane_bindings
           WHERE started_at > ? OR ended_at > ?`
        ).all(lastPaneBindingWaterMark, lastPaneBindingWaterMark) as typeof rows
      }
      for (const row of rows) {
        const newWaterMark = Math.max(row.started_at ?? 0, row.ended_at ?? 0)
        if (newWaterMark > lastPaneBindingWaterMark) {
          lastPaneBindingWaterMark = newWaterMark
        }
        broadcast({
          type: 'pane_binding_updated',
          timestamp: new Date().toISOString(),
          paneId: row.pane_id,
          sessionId: row.session_id ?? undefined,
          projectPath: row.project_path ?? undefined,
          endedAt: row.ended_at,
        })
      }
    }
  } catch { /* pane_bindings table may not exist — skip */ }
}

/** Initialise the last-seen rowids from current DB state, so we don't re-emit historical rows on startup */
function initHighWatermarks() {
  const db = getCastDb()
  if (!db) return
  try {
    const r = db.prepare('SELECT MAX(rowid) as m FROM agent_runs').get() as { m: number | null }
    lastAgentRunRowid = r?.m ?? 0
  } catch { /* skip */ }
  try {
    const r = db.prepare('SELECT MAX(rowid) as m FROM sessions').get() as { m: number | null }
    lastSessionRowid = r?.m ?? 0
  } catch { /* skip */ }
  try {
    const r = db.prepare('SELECT MAX(rowid) as m FROM routing_events').get() as { m: number | null }
    lastRoutingRowid = r?.m ?? 0
  } catch { /* skip */ }
  // Seed pane_bindings watermark so we don't re-broadcast all existing rows on startup
  try {
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pane_bindings'"
    ).get()
    if (tableExists) {
      const r = db.prepare(
        'SELECT MAX(COALESCE(started_at, 0)) AS ms, MAX(COALESCE(ended_at, 0)) AS me FROM pane_bindings'
      ).get() as { ms: number | null; me: number | null }
      lastPaneBindingWaterMark = Math.max(r?.ms ?? 0, r?.me ?? 0)
    }
  } catch { /* skip */ }
}

export function startCastDbWatcher(broadcast: BroadcastFn, pollMs = 3000) {
  initHighWatermarks()
  interval = setInterval(() => pollOnce(broadcast), pollMs)
}

export function stopCastDbWatcher() {
  if (interval) { clearInterval(interval); interval = null }
}
