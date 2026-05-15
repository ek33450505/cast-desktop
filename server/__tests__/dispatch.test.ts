/**
 * Tests for server/routes/dispatch.ts (IDE-5)
 *
 * Strategy: avoid testing `spawn` call counts (ESM mock interception is
 * unreliable for Node built-ins in Vitest). Instead test observable HTTP
 * behavior: response codes, body shapes, and _runRegistry state.
 *
 * For GET/DELETE tests that need a known-state run, we seed _runRegistry
 * directly rather than going through POST (which might actually spawn agents
 * in the test environment depending on path resolution).
 *
 * Covers:
 * 1. POST /api/dispatch — happy path: 202 + run_id + size in registry
 * 2. POST /api/dispatch — unknown agent → 400
 * 3. POST /api/dispatch — missing fields → 400 (agent, prompt, cwd each)
 * 4. POST /api/dispatch — relative cwd → 400
 * 5. GET /api/dispatch/:run_id — running status (seeded registry)
 * 6. GET /api/dispatch/:run_id — done + files_modified (seeded registry + DB mock)
 * 7. GET /api/dispatch/:run_id — failed status (seeded registry)
 * 8. GET /api/dispatch/:run_id — 404 for unknown run_id (no DB match)
 * 9. GET /api/dispatch/:run_id — status from DB (no registry entry)
 * 10. DELETE /api/dispatch/:run_id — cancels (seeded registry with process)
 * 11. DELETE /api/dispatch/:run_id — 404 for unknown run_id
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

// ── Mock child_process — prevent real agent spawns ────────────────────────────
// Note: ESM live-binding semantics mean spy.toHaveBeenCalled() assertions are
// unreliable here; we test observable behavior (registry state, HTTP responses).

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    spawn: vi.fn(() => {
      const proc = new EventEmitter() as ChildProcess
      ;(proc as unknown as Record<string, unknown>).stdout = new EventEmitter()
      ;(proc as unknown as Record<string, unknown>).stderr = new EventEmitter()
      ;(proc as unknown as Record<string, unknown>).kill = vi.fn()
      return proc
    }),
  }
})

// ── Mock getCastDb ─────────────────────────────────────────────────────────────
vi.mock('../routes/castDb.js', () => ({
  getCastDb: vi.fn(),
  getCastDbWritable: vi.fn(),
}))

import { getCastDb } from '../routes/castDb.js'
import { dispatchRouter, _runRegistry, _resetRunRegistry } from '../routes/dispatch.js'

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/api/dispatch', dispatchRouter)

// ── Helpers ───────────────────────────────────────────────────────────────────

type RunStatus = 'running' | 'done' | 'failed'

/** Seed a run entry directly into the registry for GET/DELETE tests. */
function seedRun(run_id: string, status: RunStatus, error?: string, withProcess = false) {
  const proc = withProcess
    ? (() => {
        const p = new EventEmitter() as ChildProcess
        ;(p as unknown as Record<string, unknown>).kill = vi.fn()
        return p
      })()
    : null

  _runRegistry.set(run_id, {
    status,
    process: proc,
    error,
    startedAt: Date.now(),
  })
}

function makeMockDb(
  agentRunRow: { status: string } | undefined = undefined,
  fileWriteRows: { file_path: string }[] = [],
) {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('agent_runs')) {
        return { get: vi.fn(() => agentRunRow), all: vi.fn(() => []) }
      }
      if (sql.includes('file_writes')) {
        return { get: vi.fn(() => undefined), all: vi.fn(() => fileWriteRows) }
      }
      return { get: vi.fn(() => undefined), all: vi.fn(() => []) }
    }),
  }
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  _resetRunRegistry()
  vi.mocked(getCastDb).mockReturnValue(null)
})

afterEach(() => {
  _resetRunRegistry()
})

// ── Unit 1: POST /api/dispatch ────────────────────────────────────────────────

describe('POST /api/dispatch', () => {
  it('returns 202 with run_id and status: started for a valid request', async () => {
    const sizeBefore = _runRegistry.size
    const res = await request(app)
      .post('/api/dispatch')
      .send({ agent: 'code-writer', prompt: 'Fix the bug', cwd: '/Users/ed/project' })

    expect(res.status).toBe(202)
    expect(res.body).toHaveProperty('run_id')
    expect(typeof res.body.run_id).toBe('string')
    expect(res.body.status).toBe('started')
    // Registry should have grown by 1 (or more if real spawn happened too fast)
    expect(_runRegistry.size).toBeGreaterThan(sizeBefore)
  })

  it('returns 400 for unknown agent', async () => {
    const res = await request(app)
      .post('/api/dispatch')
      .send({ agent: 'evil-agent', prompt: 'Do bad things', cwd: '/Users/ed/project' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Unknown agent/)
    expect(_runRegistry.size).toBe(0)
  })

  it('returns 400 when agent is missing', async () => {
    const res = await request(app)
      .post('/api/dispatch')
      .send({ prompt: 'Fix bug', cwd: '/Users/ed/project' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/agent/)
  })

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/dispatch')
      .send({ agent: 'code-writer', cwd: '/Users/ed/project' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/prompt/)
  })

  it('returns 400 when cwd is missing', async () => {
    const res = await request(app)
      .post('/api/dispatch')
      .send({ agent: 'code-writer', prompt: 'Fix bug' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/cwd/)
  })

  it('returns 400 for relative cwd', async () => {
    const res = await request(app)
      .post('/api/dispatch')
      .send({ agent: 'code-writer', prompt: 'Fix bug', cwd: 'relative/path' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/absolute/)
  })

  it('accepts all whitelisted agents', async () => {
    const agents = ['code-writer', 'debugger', 'test-writer', 'researcher']
    for (const agent of agents) {
      const res = await request(app)
        .post('/api/dispatch')
        .send({ agent, prompt: 'Task', cwd: '/Users/ed/project' })
      expect(res.status).toBe(202)
    }
  })
})

// ── Unit 2: GET /api/dispatch/:run_id ────────────────────────────────────────

describe('GET /api/dispatch/:run_id', () => {
  it('returns running status for a seeded running run', async () => {
    seedRun('run-abc-running', 'running', undefined, true)

    const res = await request(app).get('/api/dispatch/run-abc-running')
    expect(res.status).toBe(200)
    expect(res.body.run_id).toBe('run-abc-running')
    expect(res.body.status).toBe('running')
    expect(res.body.files_modified).toBeUndefined()
  })

  it('returns done + files_modified for a seeded done run', async () => {
    seedRun('run-abc-done', 'done')
    vi.mocked(getCastDb).mockReturnValue(
      makeMockDb(undefined, [{ file_path: '/Users/ed/project/src/foo.ts' }]) as ReturnType<typeof getCastDb>
    )

    const res = await request(app).get('/api/dispatch/run-abc-done')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('done')
    expect(res.body.files_modified).toContain('/Users/ed/project/src/foo.ts')
  })

  it('returns failed status with error for a seeded failed run', async () => {
    seedRun('run-abc-failed', 'failed', 'Agent exited with code 1')

    const res = await request(app).get('/api/dispatch/run-abc-failed')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('failed')
    expect(res.body.error).toMatch(/exit/)
  })

  it('returns 404 for unknown run_id when DB has no record', async () => {
    vi.mocked(getCastDb).mockReturnValue(makeMockDb(undefined) as ReturnType<typeof getCastDb>)

    const res = await request(app).get('/api/dispatch/nonexistent-run-id')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/)
  })

  it('returns status from DB when run is not in registry', async () => {
    vi.mocked(getCastDb).mockReturnValue(
      makeMockDb({ status: 'done' }, [{ file_path: '/Users/ed/foo.ts' }]) as ReturnType<typeof getCastDb>
    )

    const res = await request(app).get('/api/dispatch/db-backed-run-id')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('done')
    expect(res.body.files_modified).toContain('/Users/ed/foo.ts')
  })
})

// ── Unit 3: DELETE /api/dispatch/:run_id ─────────────────────────────────────

describe('DELETE /api/dispatch/:run_id', () => {
  it('marks the run as cancelled and returns cancelled: true', async () => {
    seedRun('run-abc-cancel', 'running', undefined, true)

    const res = await request(app).delete('/api/dispatch/run-abc-cancel')
    expect(res.status).toBe(200)
    expect(res.body.cancelled).toBe(true)
    expect(res.body.run_id).toBe('run-abc-cancel')

    const entry = _runRegistry.get('run-abc-cancel')!
    expect(entry.status).toBe('failed')
    expect(entry.error).toMatch(/Cancelled/)
  })

  it('returns 404 for unknown run_id', async () => {
    const res = await request(app).delete('/api/dispatch/ghost-run')
    expect(res.status).toBe(404)
  })
})
