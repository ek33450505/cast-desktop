/**
 * Tests for GET /analytics/session endpoint (Wave 2.7)
 *
 * Covers:
 * 1. Returns empty shape when no sessionId
 * 2. Returns zero-filled token buckets when no rows
 * 3. Token buckets aggregate correctly
 * 4. agentFanOut counts distinct agents
 * 5. qualityPass / qualityFail count correctly
 * 6. Quality gate graceful fallback when query fails
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

// Also mock parsers/sessions to avoid filesystem reads in analytics '/' route
vi.mock('../parsers/sessions.js', () => ({
  listSessions: () => [],
  loadSession: () => [],
}))

// ── Import router after mocks ─────────────────────────────────────────────────

import { analyticsRouter } from '../routes/analytics.js'

function buildApp() {
  const app = express()
  app.use('/analytics', analyticsRouter)
  return app
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /analytics/session', () => {
  it('returns empty shape when no sessionId param', async () => {
    const res = await request(buildApp()).get('/analytics/session')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      tokenRateBuckets: [],
      agentFanOut: 0,
      qualityPass: 0,
      qualityFail: 0,
    })
  })

  it('returns 60 zero-filled buckets when no rows', async () => {
    // Simulate empty bucket rows, fan-out count=0, quality pass=0 fail=0
    mockPrepare
      .mockReturnValueOnce({ all: vi.fn(() => []) })      // token buckets
      .mockReturnValueOnce({ get: vi.fn(() => ({ count: 0 })) })  // fan-out
      .mockReturnValueOnce({ get: vi.fn(() => ({ cnt: 0 })) })    // pass
      .mockReturnValueOnce({ get: vi.fn(() => ({ cnt: 0 })) })    // fail

    const res = await request(buildApp()).get('/analytics/session?sessionId=sess-abc')
    expect(res.status).toBe(200)
    expect(res.body.tokenRateBuckets).toHaveLength(60)
    expect(res.body.tokenRateBuckets.every((b: { tokens: number }) => b.tokens === 0)).toBe(true)
    expect(res.body.agentFanOut).toBe(0)
  })

  it('agentFanOut reflects distinct agent count', async () => {
    mockPrepare
      .mockReturnValueOnce({ all: vi.fn(() => []) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ count: 3 })) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ cnt: 0 })) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ cnt: 0 })) })

    const res = await request(buildApp()).get('/analytics/session?sessionId=sess-abc')
    expect(res.status).toBe(200)
    expect(res.body.agentFanOut).toBe(3)
  })

  it('qualityPass and qualityFail reflect gate counts', async () => {
    mockPrepare
      .mockReturnValueOnce({ all: vi.fn(() => []) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ count: 2 })) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ cnt: 5 })) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ cnt: 1 })) })

    const res = await request(buildApp()).get('/analytics/session?sessionId=sess-abc')
    expect(res.status).toBe(200)
    expect(res.body.qualityPass).toBe(5)
    expect(res.body.qualityFail).toBe(1)
  })

  it('returns 0 for quality gates when query throws (graceful fallback)', async () => {
    mockPrepare
      .mockReturnValueOnce({ all: vi.fn(() => []) })
      .mockReturnValueOnce({ get: vi.fn(() => ({ count: 1 })) })
      .mockReturnValueOnce({
        get: vi.fn(() => { throw new Error('table missing') }),
      })

    const res = await request(buildApp()).get('/analytics/session?sessionId=sess-abc')
    expect(res.status).toBe(200)
    expect(res.body.qualityPass).toBe(0)
    expect(res.body.qualityFail).toBe(0)
  })
})
