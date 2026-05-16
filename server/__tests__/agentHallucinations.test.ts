import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ── In-memory test DB ─────────────────────────────────────────────────────────

let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE agent_hallucinations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT,
      agent_name    TEXT NOT NULL,
      claim_type    TEXT NOT NULL,
      claimed_value TEXT,
      actual_value  TEXT,
      verified      INTEGER NOT NULL DEFAULT 0,
      timestamp     TEXT NOT NULL DEFAULT ''
    )
  `)
  return db
}

// Mock getCastDb before importing the router
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => null,
}))

const { agentHallucinationsRouter } = await import('../routes/agentHallucinations.js')

const app = express()
app.use(express.json())
app.use('/', agentHallucinationsRouter)

// ── Seed helpers ──────────────────────────────────────────────────────────────

function seedRow(
  db: ReturnType<typeof Database>,
  opts: {
    agent_name: string
    claim_type?: string
    verified?: number
    timestamp?: string
    session_id?: string | null
    claimed_value?: string | null
    actual_value?: string | null
  }
) {
  db.prepare(`
    INSERT INTO agent_hallucinations
      (session_id, agent_name, claim_type, claimed_value, actual_value, verified, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.session_id ?? null,
    opts.agent_name,
    opts.claim_type ?? 'file_write',
    opts.claimed_value ?? '/some/path.ts',
    opts.actual_value ?? null,
    opts.verified ?? 0,
    opts.timestamp ?? '2026-05-01T00:00:00Z'
  )
}

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
// GET /api/agent-hallucinations
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/agent-hallucinations', () => {
  it('returns 200 with hallucinations array and total', async () => {
    seedRow(testDb!, { agent_name: 'researcher' })
    seedRow(testDb!, { agent_name: 'code-writer' })

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('hallucinations')
    expect(Array.isArray(res.body.hallucinations)).toBe(true)
    expect(res.body).toHaveProperty('total', 2)
    expect(res.body.hallucinations).toHaveLength(2)
  })

  it('filters by agent_name', async () => {
    seedRow(testDb!, { agent_name: 'researcher' })
    seedRow(testDb!, { agent_name: 'code-writer' })
    seedRow(testDb!, { agent_name: 'researcher' })

    const res = await request(app).get('/?agent=researcher')

    expect(res.status).toBe(200)
    expect(res.body.hallucinations).toHaveLength(2)
    expect(res.body.total).toBe(2)
    for (const row of res.body.hallucinations) {
      expect(row.agent_name).toBe('researcher')
    }
  })

  it('clamps limit to 500 when limit=999 is requested', async () => {
    // Insert 501 rows to verify the cap bites
    for (let i = 0; i < 501; i++) {
      seedRow(testDb!, {
        agent_name: 'researcher',
        timestamp: `2026-05-${String(i % 28 + 1).padStart(2, '0')}T00:00:00Z`,
      })
    }

    const res = await request(app).get('/?limit=999')

    expect(res.status).toBe(200)
    expect(res.body.hallucinations.length).toBeLessThanOrEqual(500)
    expect(res.body.total).toBe(501)
  })

  it('filters verified=1 and returns only verified rows', async () => {
    seedRow(testDb!, { agent_name: 'researcher', verified: 0 })
    seedRow(testDb!, { agent_name: 'code-writer', verified: 1 })
    seedRow(testDb!, { agent_name: 'debugger', verified: 1 })

    const res = await request(app).get('/?verified=1')

    expect(res.status).toBe(200)
    expect(res.body.hallucinations).toHaveLength(2)
    for (const row of res.body.hallucinations) {
      expect(row.verified).toBe(1)
    }
  })

  it('coerces verified=true identically to verified=1', async () => {
    seedRow(testDb!, { agent_name: 'researcher', verified: 0 })
    seedRow(testDb!, { agent_name: 'code-writer', verified: 1 })

    const resNumeric = await request(app).get('/?verified=1')
    const resBool = await request(app).get('/?verified=true')

    expect(resNumeric.body.total).toBe(resBool.body.total)
    expect(resNumeric.body.hallucinations.length).toBe(resBool.body.hallucinations.length)
  })

  it('returns 400 for malformed date_from', async () => {
    const res = await request(app).get('/?date_from=not-a-date')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/date_from/)
  })

  it('returns 400 when date_from has trailing content (e.g. ISO timestamp)', async () => {
    const res = await request(app).get('/?date_from=2024-01-01T00:00:00')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/date_from/)
  })

  it('returns 400 for malformed date_to', async () => {
    const res = await request(app).get('/?date_to=yesterday')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/date_to/)
  })

  it('returns 400 for unknown verified value', async () => {
    const res = await request(app).get('/?verified=maybe')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/verified/)
  })

  it('returns 500 when the DB throws', async () => {
    testDb!.close()
    const brokenDb = new Database(':memory:')
    brokenDb.close()
    testDb = brokenDb

    const res = await request(app).get('/')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 200 with empty array when table is missing', async () => {
    // Recreate DB without the agent_hallucinations table
    testDb?.close()
    testDb = new Database(':memory:')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ hallucinations: [], total: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent-hallucinations/summary
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/agent-hallucinations/summary', () => {
  it('returns 200 with byAgent array sorted by total DESC and grand total', async () => {
    seedRow(testDb!, { agent_name: 'researcher', verified: 0 })
    seedRow(testDb!, { agent_name: 'researcher', verified: 1 })
    seedRow(testDb!, { agent_name: 'researcher', verified: 0 })
    seedRow(testDb!, { agent_name: 'code-writer', verified: 1 })
    seedRow(testDb!, { agent_name: 'code-writer', verified: 0 })
    seedRow(testDb!, { agent_name: 'debugger', verified: 0 })

    const res = await request(app).get('/summary')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('byAgent')
    expect(Array.isArray(res.body.byAgent)).toBe(true)
    expect(res.body).toHaveProperty('total', 6)

    // sorted by total DESC: researcher(3), code-writer(2), debugger(1)
    expect(res.body.byAgent[0].agent_name).toBe('researcher')
    expect(res.body.byAgent[0].total).toBe(3)
    expect(res.body.byAgent[0].verified).toBe(1)
    expect(res.body.byAgent[0].unverified).toBe(2)

    expect(res.body.byAgent[1].agent_name).toBe('code-writer')
    expect(res.body.byAgent[1].total).toBe(2)

    expect(res.body.byAgent[2].agent_name).toBe('debugger')
    expect(res.body.byAgent[2].total).toBe(1)

    // grand total matches sum of byAgent totals
    const sumOfTotals = res.body.byAgent.reduce(
      (acc: number, row: { total: number }) => acc + row.total,
      0
    )
    expect(res.body.total).toBe(sumOfTotals)
  })

  it('returns 500 when the DB throws on summary', async () => {
    testDb!.close()
    const brokenDb = new Database(':memory:')
    brokenDb.close()
    testDb = brokenDb

    const res = await request(app).get('/summary')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 200 with empty result when table is missing', async () => {
    testDb?.close()
    testDb = new Database(':memory:')

    const res = await request(app).get('/summary')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ byAgent: [], total: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent-hallucinations/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/agent-hallucinations/:id', () => {
  it('returns 200 with the full row for a valid id', async () => {
    seedRow(testDb!, {
      agent_name: 'researcher',
      claimed_value: 'a'.repeat(600),
      actual_value: 'b'.repeat(600),
    })
    const inserted = testDb!.prepare('SELECT id FROM agent_hallucinations').get() as { id: number }

    const res = await request(app).get(`/${inserted.id}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', inserted.id)
    expect(res.body).toHaveProperty('agent_name', 'researcher')
    // Full values — not truncated
    expect(res.body.claimed_value).toHaveLength(600)
    expect(res.body.actual_value).toHaveLength(600)
  })

  it('returns 404 for an id that does not exist', async () => {
    const res = await request(app).get('/999999')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 for a non-integer id', async () => {
    const res = await request(app).get('/abc')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 404 when table is missing', async () => {
    testDb?.close()
    testDb = new Database(':memory:')

    const res = await request(app).get('/1')

    expect(res.status).toBe(404)
  })
})
