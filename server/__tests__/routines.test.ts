import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ── In-memory test DB ─────────────────────────────────────────────────────────

let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE routines (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      trigger_type        TEXT NOT NULL,
      trigger_value       TEXT,
      agent_to_dispatch   TEXT NOT NULL,
      prompt_template     TEXT NOT NULL DEFAULT '',
      output_dir          TEXT NOT NULL DEFAULT '',
      enabled             INTEGER NOT NULL DEFAULT 1,
      last_run_at         TEXT,
      last_run_status     TEXT,
      last_run_output_path TEXT,
      created_at          TEXT NOT NULL DEFAULT ''
    )
  `)
  return db
}

// Seed the daily-briefing row matching production data
function seedDailyBriefing(
  db: ReturnType<typeof Database>,
  outputPath: string | null = null
) {
  db.prepare(`
    INSERT INTO routines
      (id, name, trigger_type, trigger_value, agent_to_dispatch, prompt_template,
       output_dir, enabled, last_run_at, last_run_status, last_run_output_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'c1878ce2-7174-47c0-9bd4-6cad044bfd9c',
    'daily-briefing',
    'cron',
    '0 7 * * *',
    'morning-briefing',
    'Run the daily briefing.',
    '~/.claude/routines-output/daily-briefing',
    1,
    '2026-05-11T01:12:49Z',
    'failure',
    outputPath,
    '2026-05-11T01:10:31Z'
  )
}

// Mock getCastDb before importing the router
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => null,
}))

const { routinesRouter } = await import('../routes/routines.js')

const app = express()
app.use(express.json())
app.use('/', routinesRouter)

// ─────────────────────────────────────────────────────────────────────────────
// Test lifecycle
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/routines
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/routines', () => {
  it('returns 200 with routines array when table is empty', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('routines')
    expect(Array.isArray(res.body.routines)).toBe(true)
    expect(res.body.routines).toHaveLength(0)
  })

  it('returns 200 with routines array when db is null', async () => {
    testDb?.close()
    testDb = null

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ routines: [] })
  })

  it('returns the daily-briefing routine row with required fields', async () => {
    seedDailyBriefing(testDb!)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.routines).toHaveLength(1)

    const row = res.body.routines[0]
    expect(row.name).toBe('daily-briefing')
    expect(row.last_run_status).toBe('failure')
    expect(row.trigger_type).toBe('cron')
    expect(row.trigger_value).toBe('0 7 * * *')
    expect(row.agent).toBe('morning-briefing')
    expect(row).toHaveProperty('id')
    expect(row).toHaveProperty('last_run_at')
    expect(row).toHaveProperty('last_run_output_path')
    expect(row).toHaveProperty('created_at')
  })

  it('returns 500 when the DB throws', async () => {
    // Replace the db with one that has been closed (triggers error on query)
    testDb!.close()
    // Create a non-null but broken db by creating a new one and closing it
    const brokenDb = new Database(':memory:')
    brokenDb.close()
    testDb = brokenDb

    const res = await request(app).get('/')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/routines/:id/output
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/routines/:id/output', () => {
  it('returns 404 for an unknown routine id', async () => {
    const res = await request(app).get('/nonexistent-id/output')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error', 'routine_not_found')
  })

  it('returns not_found reason when last_run_output_path is null', async () => {
    seedDailyBriefing(testDb!, null)

    const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: null, reason: 'not_found' })
  })

  it('returns not_found reason when file does not exist on disk', async () => {
    const allowedPath = path.join(os.homedir(), '.claude', 'routines-output', 'nonexistent-output.md')
    seedDailyBriefing(testDb!, allowedPath)

    const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: null, reason: 'not_found' })
  })

  it('returns file content when path is valid and file exists', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-routines-test-'))
    const allowedDir = path.join(os.homedir(), '.claude', 'routines-output')
    // Use a real path within the allowed prefix by symlinking
    // Since we can't guarantee ~/.claude/routines-output exists in test env,
    // we test the not_found path gracefully for a valid-prefix path.
    // For a true content test, we write to the actual allowed dir if it exists.
    const existingAllowedPath = path.join(allowedDir, 'test-output-routines-vitest.md')

    fs.mkdirSync(allowedDir, { recursive: true })
    fs.writeFileSync(existingAllowedPath, '# Test Output\nSome content.')

    try {
      seedDailyBriefing(testDb!, existingAllowedPath)

      const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

      expect(res.status).toBe(200)
      expect(res.body.content).toContain('# Test Output')
      expect(res.body.path).toBe(existingAllowedPath)
    } finally {
      fs.rmSync(existingAllowedPath, { force: true })
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('returns not_found for a path traversal attempt (../../etc/passwd pattern)', async () => {
    // Simulate a compromised DB row with an adversarial path; response is
    // unified to not_found to avoid leaking filesystem enumeration info.
    const traversalPath = '/etc/passwd'
    seedDailyBriefing(testDb!, traversalPath)

    const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: null, reason: 'not_found' })
  })

  it('returns not_found for a path with double-dot traversal segments', async () => {
    const traversalPath = `${os.homedir()}/.claude/routines-output/../../../etc/passwd`
    seedDailyBriefing(testDb!, traversalPath)

    const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: null, reason: 'not_found' })
  })

  it('returns not_found for a path outside the allowed prefix even if no traversal chars', async () => {
    const outsidePath = '/tmp/malicious-output.md'
    seedDailyBriefing(testDb!, outsidePath)

    const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ content: null, reason: 'not_found' })
  })

  it('returns not_found for a symlink inside prefix pointing outside (realpath guard)', async () => {
    // Create a symlink within the allowed prefix that points to /etc/passwd.
    // This tests the realpathSync second-layer guard.
    const allowedDir = path.join(os.homedir(), '.claude', 'routines-output')
    fs.mkdirSync(allowedDir, { recursive: true })
    const symlinkPath = path.join(allowedDir, 'test-symlink-vitest.md')

    // Remove stale symlink from prior failed run if present
    try { fs.unlinkSync(symlinkPath) } catch { /* not present */ }
    fs.symlinkSync('/etc/passwd', symlinkPath)

    try {
      seedDailyBriefing(testDb!, symlinkPath)

      const res = await request(app).get('/c1878ce2-7174-47c0-9bd4-6cad044bfd9c/output')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ content: null, reason: 'not_found' })
    } finally {
      try { fs.unlinkSync(symlinkPath) } catch { /* already gone */ }
    }
  })
})
