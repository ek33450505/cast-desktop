import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE pane_bindings (
      pane_id      TEXT PRIMARY KEY,
      session_id   TEXT,
      started_at   INTEGER,
      ended_at     INTEGER,
      project_path TEXT
    )
  `)
  return db
}

// Mock getCastDb and getCastDbWritable before importing the router
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  // Return a no-op for getCastDbWritable so ensurePaneBindingsTable() doesn't fail
  getCastDbWritable: () => null,
}))

const { paneBindingsRouter } = await import('../routes/paneBindings.js')

const app = express()
app.use(express.json())
app.use('/', paneBindingsRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:paneId
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/pane-bindings/:paneId', () => {
  it('returns 404 with error shape for unknown paneId', async () => {
    const res = await request(app).get('/unknown-pane-id-xyz')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error', 'pane binding not found')
  })

  it('returns 200 with full shape including endedAt: null for active pane', async () => {
    testDb!.prepare(
      'INSERT INTO pane_bindings (pane_id, session_id, started_at, ended_at, project_path) VALUES (?, ?, ?, ?, ?)'
    ).run('pane-abc-123', 'sess-xyz', 1715000000, null, '/Users/dev/my-project')

    const res = await request(app).get('/pane-abc-123')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      paneId: 'pane-abc-123',
      sessionId: 'sess-xyz',
      startedAt: 1715000000,
      endedAt: null,
      projectPath: '/Users/dev/my-project',
    })
  })

  it('returns 200 with endedAt as number after pane is ended', async () => {
    testDb!.prepare(
      'INSERT INTO pane_bindings (pane_id, session_id, started_at, ended_at, project_path) VALUES (?, ?, ?, ?, ?)'
    ).run('pane-def-456', 'sess-abc', 1715000000, null, '/Users/dev/project')

    // Update ended_at to simulate pane closing
    testDb!.prepare(
      'UPDATE pane_bindings SET ended_at = ? WHERE pane_id = ?'
    ).run(1715009999, 'pane-def-456')

    const res = await request(app).get('/pane-def-456')

    expect(res.status).toBe(200)
    expect(res.body.paneId).toBe('pane-def-456')
    expect(res.body.endedAt).toBe(1715009999)
    expect(typeof res.body.endedAt).toBe('number')
  })

  it('returns 404 when db is null', async () => {
    testDb?.close()
    testDb = null

    const res = await request(app).get('/pane-abc-123')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error', 'pane binding not found')
  })
})

