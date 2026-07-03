/**
 * Schema Drift Guard — Unit B of v8-wiring remediation
 *
 * This test fails when a desktop SQL query references a table/column the framework's
 * real v8 schema doesn't provide, preventing silent breakage from future v8 schema changes.
 *
 * Phase-4 Defects Tracked:
 * 1. dispatch_decisions: columns dispatch_backend, plan_file don't exist in v8
 *    Reference: server/routes/qualityGates.ts:118-119 (FIXED)
 * 2. stream_events: writer has wrong columns (POST, not in GET sweep, documented)
 *    Reference: server/routes/hookEvents.ts:73
 * 3. task_queue.result_summary: phantom column in queries (FIXED — column removed from SELECT
 *    in taskQueue.ts and UPDATE in control.ts; now asserted absent in column contract test)
 * 4. budget/config: readonly-write defect (POST, not in GET sweep)
 * 5. [Phase-4 ledger] — TODO: wire framework's cast-db-contract.py extractor for
 *    fully-automated column coverage after Phase 4 fixes land
 *
 * Strategy:
 * - Test 1: Endpoint sweep (core guard) — enumerate DB-backed GET endpoints,
 *   assert each returns expected status, not 500. Collect failures for audit.
 * - Test 2: Column contract — assert required columns present, document known drift.
 * - Quarantine known Phase-4 defects with expectedStatus arrays so CI stays green.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'
import fs from 'fs'
import { v8InitAvailable, buildTempV8Db, cleanupTempDb } from './helpers/tempV8Db.js'

let app: ReturnType<typeof express> | null = null
let tempDbPath = ''

// Helper: extract column names from a table
function getTableColumns(db: Database.Database, tableName: string): Set<string> {
  try {
    const stmt = db.prepare(`PRAGMA table_info(${tableName})`)
    const info = stmt.all() as Array<{ cid: number; name: string; type: string }>
    const columns = new Set<string>()
    for (const col of info) {
      columns.add(col.name)
    }
    return columns
  } catch (err) {
    console.error(`Failed to get columns for ${tableName}:`, err)
    return new Set()
  }
}

describe.skipIf(!v8InitAvailable())('dbContract — Schema Drift Guard (v8)', () => {
  beforeAll(async () => {
    // Build temp v8 DB with full schema
    tempDbPath = buildTempV8Db()

    // Override CAST_DB_PATH before any module imports
    process.env.CAST_DB_PATH = tempDbPath

    // Clear module cache so express/routes pick up the env var
    vi.resetModules()

    // Dynamically import express and the router
    const expressModule = await import('express')
    const routerModule = await import('../routes/index.js')

    const expressDefault = (expressModule as unknown as { default?: typeof express }).default || expressModule
    app = express()
    app.use(expressDefault.json())
    app.use('/api', routerModule.router)
  })

  afterAll(() => {
    delete process.env.CAST_DB_PATH
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      cleanupTempDb(tempDbPath)
    }
  })

  describe('Test 1: Endpoint Sweep (core durable guard)', () => {
    /**
     * Enumerate DB-backed GET endpoints and report any that return unexpected status.
     * A 500 indicates a SQL error against the real v8 schema — the guard
     * will catch column/table mismatches on first run.
     *
     * Strategy:
     * - COLLECTION endpoints (no path params): assert status === 200 exactly. A 404 now FAILS
     *   (prevents silent-gap regression).
     * - LOOKUP endpoints (with :id params): assert status !== 500 (200 or 404 both valid).
     * - KNOWN_BROKEN: quarantine with comment; Phase 4 fix will flip status, turning assertion RED
     *   as a self-clearing reminder.
     */
    it('sweeps all GET endpoints and collects status errors', async () => {
      // COLLECTION endpoints: assert 200 (no path params)
      const collectionEndpoints = [
        { path: '/api/cast/active-agents', expected: 200 },
        { path: '/api/cast/agent-runs', expected: 200 },
        { path: '/api/cast/session-agents', expected: 200 },
        { path: '/api/cast/worktrees', expected: 200 },
        { path: '/api/sessions', expected: 200 },
        { path: '/api/memory/agent', expected: 200 }, // Frontend calls this (useMemory.ts)
        { path: '/api/memory/project', expected: 200 }, // Frontend calls this (useMemory.ts)
        { path: '/api/plans', expected: 200 },
        { path: '/api/plans/active', expected: 200 },
        { path: '/api/quality-gates', expected: 200 },
        { path: '/api/quality-gates/stats', expected: 200 },
        { path: '/api/agent-truncations', expected: 200 },
        { path: '/api/injection-log', expected: 200 },
        { path: '/api/unstaged-warnings', expected: 200 },
        { path: '/api/cast/compaction-events', expected: 200 },
        { path: '/api/cast/tool-failures', expected: 200 },
        { path: '/api/cast/events', expected: 200 },
        { path: '/api/cast/research-cache/stats', expected: 200 }, // Real endpoint (Frontend calls)
        { path: '/api/stop-failure-events', expected: 200 },
        { path: '/api/agent-protocol-violations', expected: 200 },
        { path: '/api/routines', expected: 200 },
        { path: '/api/agent-hallucinations', expected: 200 },
        { path: '/api/hook-failures', expected: 200 },
        { path: '/api/incidents', expected: 200 },
        { path: '/api/routing/events', expected: 200 }, // Real endpoint (not /api/routing root)
        { path: '/api/routing/event-types', expected: 200 }, // Real endpoint
        { path: '/api/routing/stats', expected: 200 }, // Real endpoint (Frontend calls this)
        { path: '/api/swarm/sessions', expected: 200 },
        { path: '/api/cast/memories', expected: 200 },
        { path: '/api/analytics', expected: 200 },
        { path: '/api/hook-events/recent', expected: 200 }, // Real endpoint (hookEventsRouter only has /recent GET)
        { path: '/api/dispatch-decisions', expected: 200 },
        { path: '/api/cast/task-queue', expected: 200 },
      ]

      // LOOKUP endpoints: assert !== 500 (200 or 404 both valid due to fake ids)
      const lookupEndpoints = [
        { path: '/api/agents/running?sessionId=test-session', notStatus: 500 },
        { path: '/api/agents/runs/test-run-id', notStatus: 500 },
        { path: '/api/cast/session-agents/test-session', notStatus: 500 },
        { path: '/api/pane-bindings/test-pane', notStatus: 500 },
        { path: '/api/files', notStatus: 500 },
      ]

      const errors: Array<{ path: string; status: number; reason: string }> = []

      // Check COLLECTION endpoints
      for (const ep of collectionEndpoints) {
        const res = await request(app).get(ep.path)
        if (res.status !== ep.expected) {
          errors.push({
            path: ep.path,
            status: res.status,
            reason: `expected ${ep.expected}, got ${res.status} (silent-gap audit)`,
          })
        }
      }

      // Check LOOKUP endpoints
      for (const ep of lookupEndpoints) {
        const res = await request(app).get(ep.path)
        if (res.status === ep.notStatus) {
          errors.push({
            path: ep.path,
            status: res.status,
            reason: `should not be ${ep.notStatus} (likely SQL error on fake id, not 404)`,
          })
        }
      }

      if (errors.length > 0) {
        const msg = errors.map((e) => `  ${e.path} → ${e.status}\n    (${e.reason})`).join('\n')
        console.log('Endpoint Status Errors (audit signal):\n' + msg)
      }

      expect(errors).toEqual([])
    }, 15000)
  })

  describe('Test 2: Column Contract (lighter validation)', () => {
    /**
     * Assert that required columns exist in the v8 schema.
     * Document known drift (columns that will be fixed in Phase 4).
     * v8 authoritative columns: see cast-db-init.sh schema definitions.
     */
    it('agent_runs table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'agent_runs')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('session_id')).toBe(true)
      expect(cols.has('agent')).toBe(true)
      expect(cols.has('status')).toBe(true)
      expect(cols.has('input_tokens')).toBe(true)
      expect(cols.has('output_tokens')).toBe(true)
      expect(cols.has('cost_usd')).toBe(true)
      expect(cols.has('started_at')).toBe(true)
      db.close()
    })

    it('quality_gates table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'quality_gates')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('agent_name')).toBe(true)
      expect(cols.has('contract_passed')).toBe(true)
      expect(cols.has('timestamp')).toBe(true)
      expect(cols.has('status_line')).toBe(true)
      db.close()
    })

    it('sessions table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'sessions')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('started_at')).toBe(true)
      db.close()
    })

    it('agent_memories table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'agent_memories')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('agent')).toBe(true) // Note: 'agent', not 'agent_name'
      expect(cols.has('created_at')).toBe(true)
      db.close()
    })

    it('dispatch_decisions table: all ten canonical columns exist and endpoint returns data', async () => {
      // Open DB writable to assert schema and insert a fixture row
      const db = new Database(tempDbPath)
      const cols = getTableColumns(db, 'dispatch_decisions')

      // Assert ALL ten canonical columns exist (hard — must fail on any future drift)
      const canonicalCols = [
        'id', 'session_id', 'prompt_snippet', 'chosen_agent', 'model',
        'effort', 'wave_id', 'parallel', 'created_at', 'outcome',
      ]
      for (const col of canonicalCols) {
        expect(cols.has(col), `dispatch_decisions.${col} must exist in canonical v9 schema`).toBe(true)
      }

      // Assert v7 ghost columns do NOT exist
      expect(cols.has('timestamp'), 'dispatch_decisions.timestamp must NOT exist (v7 ghost)').toBe(false)
      expect(cols.has('dispatch_backend'), 'dispatch_decisions.dispatch_backend must NOT exist (v7 ghost)').toBe(false)
      expect(cols.has('plan_file'), 'dispatch_decisions.plan_file must NOT exist (v7 ghost)').toBe(false)

      // Insert one canonical fixture row
      db.prepare(`
        INSERT INTO dispatch_decisions
          (session_id, prompt_snippet, chosen_agent, model, effort, wave_id, parallel, created_at, outcome)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'fixture-session-id',
        'test prompt snippet for schema guard',
        'code-writer',
        'claude-sonnet-4-5',
        'high',
        'wave-1',
        0,
        new Date().toISOString(),
        'pending',
      )
      db.close()

      // Assert the endpoint returns the inserted row (hard — must fail if query is broken)
      const res = await request(app).get('/api/dispatch-decisions')
      expect(res.status).toBe(200)
      expect(res.body.decisions).toBeDefined()
      expect(res.body.decisions.length).toBeGreaterThan(0)

      // Verify canonical column shape in the response
      const decision = res.body.decisions[0]
      expect(decision.chosen_agent).toBe('code-writer')
      expect(decision.prompt_snippet).toBe('test prompt snippet for schema guard')
      expect(decision.outcome).toBe('pending')
    })

    it('task_queue table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'task_queue')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('task')).toBe(true) // Note: 'task', not 'task_id'
      expect(cols.has('status')).toBe(true)
      expect(cols.has('result_summary'), 'task_queue.result_summary must NOT exist in canonical schema').toBe(false)
      db.close()
    })

    it('routing_events table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'routing_events')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('event_type')).toBe(true)
      expect(cols.has('timestamp')).toBe(true)
      db.close()
    })

    it('swarm_sessions table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'swarm_sessions')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('started_at')).toBe(true) // Note: 'started_at', not 'created_at'
      db.close()
    })

    it('hook_failures table has required columns', () => {
      const db = new Database(tempDbPath, { readonly: true })
      const cols = getTableColumns(db, 'hook_failures')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('hook_name')).toBe(true)
      expect(cols.has('stderr')).toBe(true) // Note: 'stderr', not 'error_msg'
      expect(cols.has('timestamp')).toBe(true)
      db.close()
    })
  })
})
