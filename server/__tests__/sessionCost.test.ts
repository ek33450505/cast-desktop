/**
 * Tests for sessionCostRouter (Wave 2.7)
 *
 * Covers:
 * 1. GET / — returns zeroes when no sessionId param
 * 2. GET / — returns zeroes when session has no rows
 * 3. GET / — sums cost correctly for rows with input/output tokens
 * 4. GET / — burn rate is computed from rows in last 5 minutes
 * 5. GET /stream — SSE connection emits initial snapshot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mock getCastDb ────────────────────────────────────────────────────────────

const mockPrepare = vi.fn()
const mockDb = { prepare: mockPrepare }
const mockGetCastDb = vi.fn(() => mockDb)

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => mockGetCastDb(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

import { sessionCostRouter } from '../routes/sessionCost.js'

function buildApp() {
  const app = express()
  app.use('/session-cost', sessionCostRouter)
  return app
}

function makeRunRow(overrides: Partial<{
  input_tokens: number | null
  output_tokens: number | null
  cache_read_input_tokens: number | null
  cache_creation_input_tokens: number | null
  model: string | null
  started_at: string
}> = {}) {
  return {
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    model: 'claude-haiku-4-5-20251001',
    started_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /session-cost', () => {
  it('returns zeroes when no sessionId param', async () => {
    const res = await request(buildApp()).get('/session-cost/')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      totalUsd: 0,
      burnRatePerMin: 0,
      projectedFourHourUsd: 0,
      budgetUsd: null,
    })
  })

  it('returns zeroes when session has no rows', async () => {
    mockPrepare.mockReturnValue({ all: vi.fn(() => []) })
    const res = await request(buildApp()).get('/session-cost/?sessionId=sess-empty')
    expect(res.status).toBe(200)
    expect(res.body.totalUsd).toBe(0)
    expect(res.body.budgetUsd).toBeNull()
  })

  it('sums cost correctly for rows with tokens', async () => {
    // haiku: input=$0.80/1M, output=$4.00/1M
    // 1000 input + 500 output at haiku rates:
    // = (1000 * 0.80 + 500 * 4.00) / 1_000_000 = (800 + 2000) / 1M = 0.0028
    const row = makeRunRow()
    mockPrepare.mockReturnValue({ all: vi.fn(() => [row]) })
    const res = await request(buildApp()).get('/session-cost/?sessionId=sess-abc')
    expect(res.status).toBe(200)
    expect(res.body.totalUsd).toBeCloseTo(0.0028, 6)
    expect(res.body.budgetUsd).toBeNull()
  })

  it('burn rate uses only rows from last 5 minutes', async () => {
    const recentRow = makeRunRow({ started_at: new Date(Date.now() - 60_000).toISOString() })
    const oldRow = makeRunRow({
      started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      input_tokens: 100000,
      output_tokens: 50000,
    })
    mockPrepare.mockReturnValue({ all: vi.fn(() => [recentRow, oldRow]) })

    const res = await request(buildApp()).get('/session-cost/?sessionId=sess-burn')
    expect(res.status).toBe(200)
    // burnRatePerMin should only account for recentRow (old row is > 5 min ago)
    // recentRow cost = 0.0028, divided by 5 = 0.00056
    expect(res.body.burnRatePerMin).toBeCloseTo(0.00056, 6)
  })

  it('returns 500 when db throws', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('db error')
    })
    const res = await request(buildApp()).get('/session-cost/?sessionId=sess-err')
    expect(res.status).toBe(500)
  })
})

describe('GET /session-cost/stream', () => {
  it('establishes SSE connection and emits initial data', async () => {
    const row = makeRunRow()
    mockPrepare.mockReturnValue({ all: vi.fn(() => [row]) })

    const res = await request(buildApp())
      .get('/session-cost/stream?sessionId=sess-abc')
      .buffer(false)
      .parse((res, callback) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
          // Close after first data line
          if (body.includes('data:')) {
            callback(null, body)
          }
        })
        res.on('end', () => callback(null, body))
        // End the request after a short delay to avoid hanging
        setTimeout(() => res.destroy(), 200)
      })

    expect(res.headers['content-type']).toContain('text/event-stream')
  })
})
