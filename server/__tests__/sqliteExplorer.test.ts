/**
 * Tests for sqliteExplorerRouter in server/routes/sqliteExplorer.ts (Task 2.1)
 *
 * Covers:
 * 1. GET /tables — dynamic list excludes FTS shadow tables
 * 2. GET /schema/:table — returns PRAGMA table_info output for valid table
 * 3. GET /schema/:table — returns 404 for unknown table
 * 4. GET /:table — returns 404 for table not in dynamic allowlist
 * 5. GET /:table — sort with invalid column returns 400
 * 6. GET /:table — sort with valid column returns sorted rows
 * 7. GET /:table — defaults to id DESC ordering when pk id exists, no sort param
 * 8. GET /:table — returns 404 when table name matches an FTS shadow table
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mock getCastDb ────────────────────────────────────────────────────────────

const mockAll = vi.fn()
const mockGet = vi.fn()
const mockPluck = vi.fn()
const mockPrepare = vi.fn()

const mockDb = {
  prepare: mockPrepare,
}

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => mockDb,
}))

// ── Import router after mock is established ───────────────────────────────────

import { sqliteExplorerRouter } from '../routes/sqliteExplorer.js'

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express()
  app.use('/cast/explore', sqliteExplorerRouter)
  return app
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a chainable prepare mock. Each call to prepare returns a statement object
 * whose methods can be independently configured via the returned mocks.
 */
function makePrepareChain({
  all = vi.fn(() => []),
  get = vi.fn(() => undefined),
  pluck = vi.fn(),
}: {
  all?: ReturnType<typeof vi.fn>
  get?: ReturnType<typeof vi.fn>
  pluck?: ReturnType<typeof vi.fn>
} = {}) {
  const stmt = {
    all,
    get,
    pluck: vi.fn(() => ({ all })),
  }
  if (pluck) {
    stmt.pluck = vi.fn(() => ({ all: pluck }))
  }
  return stmt
}

// ── Test state ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── GET /tables ───────────────────────────────────────────────────────────────

describe('GET /cast/explore/tables', () => {
  it('returns only non-FTS-shadow tables and includes row counts', async () => {
    // The /tables handler calls:
    //   1. prepare(sqlite_master query).pluck().all() — returns table names
    //   2. prepare(COUNT) .get() for each table — returns row count
    const tableNames = ['agent_runs', 'sessions']

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => tableNames }) }
      }
      if (sql.includes('COUNT(*)')) {
        return { get: () => ({ total: 42 }) }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/tables')

    expect(res.status).toBe(200)
    expect(res.body.tables).toHaveLength(2)
    expect(res.body.tables[0]).toMatchObject({ name: 'agent_runs', rowCount: 42 })
    expect(res.body.tables[1]).toMatchObject({ name: 'sessions', rowCount: 42 })
  })

  it('excludes FTS shadow tables from the allowlist query', async () => {
    // Verify the SQL passed to prepare excludes FTS shadow table patterns.
    // The dynamic allowlist query is what enforces this — we check the SQL string.
    let capturedSql = ''
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        capturedSql = sql
        return { pluck: () => ({ all: () => [] }) }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    await request(buildApp()).get('/cast/explore/tables')

    expect(capturedSql).toContain("NOT LIKE '%_fts%'")
    expect(capturedSql).toContain("NOT LIKE '%_content%'")
    expect(capturedSql).toContain("NOT LIKE '%_data%'")
    expect(capturedSql).toContain("NOT LIKE '%_idx%'")
  })

  it('returns empty tables array when db returns no tables', async () => {
    mockPrepare.mockImplementation(() => ({
      pluck: () => ({ all: () => [] }),
      all: () => [],
      get: () => undefined,
    }))

    const res = await request(buildApp()).get('/cast/explore/tables')

    expect(res.status).toBe(200)
    expect(res.body.tables).toEqual([])
  })
})

// ── GET /schema/:table ────────────────────────────────────────────────────────

describe('GET /cast/explore/schema/:table', () => {
  it('returns PRAGMA table_info output for a valid table', async () => {
    const pragmaOutput = [
      { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'status', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
    ]

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions', 'agent_runs'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => pragmaOutput }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/schema/sessions')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(pragmaOutput)
  })

  it('returns 404 for a table not in the dynamic allowlist', async () => {
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/schema/nonexistent_table')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: expect.stringContaining('not found') })
  })

  it('returns 404 for an FTS shadow table name even if somehow in sqlite_master', async () => {
    // The dynamic query already excludes FTS shadow tables, so this is belt-and-suspenders.
    // If an attacker tries /schema/agent_memories_fts_data, it won't be in the allowlist.
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        // allowlist never returns shadow tables (the SQL WHERE clause filters them)
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/schema/agent_memories_fts_data')

    expect(res.status).toBe(404)
  })
})

// ── GET /:table ───────────────────────────────────────────────────────────────

describe('GET /cast/explore/:table', () => {
  it('returns 404 for table not in dynamic allowlist', async () => {
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/secret_table')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: expect.stringContaining('not found') })
  })

  it('returns 400 when sort column is not a valid column name', async () => {
    const columns = [
      { name: 'id', pk: 1 },
      { name: 'status', pk: 0 },
      { name: 'started_at', pk: 0 },
    ]

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['agent_runs'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => columns }
      }
      if (sql.includes('COUNT(*)')) {
        return { get: () => ({ total: 5 }) }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/agent_runs?sort=evil_column')

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: expect.stringContaining('Invalid sort column') })
  })

  it('returns 400 for SQL injection attempt in sort param', async () => {
    const columns = [{ name: 'id', pk: 1 }, { name: 'status', pk: 0 }]

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => columns }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/sessions?sort=id;DROP%20TABLE%20sessions')

    expect(res.status).toBe(400)
  })

  it('returns sorted rows when sort column is valid', async () => {
    const columns = [
      { name: 'id', pk: 1 },
      { name: 'status', pk: 0 },
      { name: 'started_at', pk: 0 },
    ]
    const rows = [
      { id: 'run-1', status: 'done', started_at: '2026-01-01' },
      { id: 'run-2', status: 'running', started_at: '2026-01-02' },
    ]

    let capturedSql = ''
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['agent_runs'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => columns }
      }
      if (sql.includes('COUNT(*)')) {
        return { get: () => ({ total: 2 }) }
      }
      if (sql.includes('SELECT * FROM')) {
        capturedSql = sql
        return { all: () => rows }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/agent_runs?sort=started_at&dir=asc')

    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(2)
    // Verify the ORDER BY clause uses quoted identifier syntax and ASC direction
    expect(capturedSql).toContain('ORDER BY "started_at" ASC')
  })

  it('uses DESC direction when dir=desc is specified', async () => {
    const columns = [{ name: 'id', pk: 1 }, { name: 'status', pk: 0 }]
    let capturedSql = ''

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => columns }
      }
      if (sql.includes('COUNT(*)')) {
        return { get: () => ({ total: 1 }) }
      }
      if (sql.includes('SELECT * FROM')) {
        capturedSql = sql
        return { all: () => [{ id: 'a', status: 'ended' }] }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/sessions?sort=status&dir=desc')

    expect(res.status).toBe(200)
    expect(capturedSql).toContain('ORDER BY "status" DESC')
  })

  it('falls back to id DESC ordering when no sort param and table has pk id', async () => {
    const columns = [{ name: 'id', pk: 1 }, { name: 'status', pk: 0 }]
    let capturedSql = ''

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => columns }
      }
      if (sql.includes('COUNT(*)')) {
        return { get: () => ({ total: 1 }) }
      }
      if (sql.includes('SELECT * FROM')) {
        capturedSql = sql
        return { all: () => [{ id: 'a', status: 'ended' }] }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/sessions')

    expect(res.status).toBe(200)
    expect(capturedSql).toContain('ORDER BY "id" DESC')
  })

  it('includes columns, rows, total, and nullColumns in response', async () => {
    const columns = [{ name: 'id', pk: 1 }, { name: 'optional_col', pk: 0 }]
    const rows = [{ id: 'x', optional_col: null }]

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return { pluck: () => ({ all: () => ['sessions'] }) }
      }
      if (sql.includes('PRAGMA table_info')) {
        return { all: () => columns }
      }
      if (sql.includes('COUNT(*)')) {
        return { get: () => ({ total: 1 }) }
      }
      if (sql.includes('SELECT * FROM')) {
        return { all: () => rows }
      }
      return { all: () => [], get: () => undefined, pluck: () => ({ all: () => [] }) }
    })

    const res = await request(buildApp()).get('/cast/explore/sessions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      columns: ['id', 'optional_col'],
      total: 1,
      nullColumns: ['optional_col'],
    })
    expect(res.body.rows).toHaveLength(1)
  })
})
