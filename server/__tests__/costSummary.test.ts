/**
 * Tests for costSummaryRouter
 *
 * Covers:
 * 1. GET / — happy path returns correct shape with data
 * 2. GET / — empty DB returns zero totals and empty arrays
 * 3. GET / — respects the ?days query param to filter window
 * 4. GET / — ?top param limits topSessions length
 * 5. GET / — returns 500 when underlying utility throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mock jsonlTokenTotals ─────────────────────────────────────────────────────

const mockGetJsonlTokenTotals = vi.fn()
const mockGetModelBreakdown = vi.fn()
const mockGetTopSessions = vi.fn()

vi.mock('../utils/jsonlTokenTotals.js', () => ({
  getJsonlTokenTotals: (...args: unknown[]) => mockGetJsonlTokenTotals(...args),
  getModelBreakdown: (...args: unknown[]) => mockGetModelBreakdown(...args),
  getTopSessions: (...args: unknown[]) => mockGetTopSessions(...args),
}))

// ── Import router after mocks are in place ────────────────────────────────────

import { costSummaryRouter } from '../routes/costSummary.js'

function buildApp() {
  const app = express()
  app.use('/cast/cost-summary', costSummaryRouter)
  return app
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPTY_TOTALS = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costUsd: 0,
  sessionCount: 0,
}

const MOCK_TOTALS = {
  inputTokens: 50000,
  outputTokens: 20000,
  cacheCreationTokens: 5000,
  cacheReadTokens: 1000,
  costUsd: 0.47,
  sessionCount: 3,
}

const MOCK_BY_MODEL = [
  { model: 'claude-sonnet-4-6-20260320', costUsd: 0.35, sessionCount: 2 },
  { model: 'claude-haiku-4-5-20251001',  costUsd: 0.12, sessionCount: 1 },
]

const MOCK_TOP_SESSIONS = [
  { id: 'aaa-111', project: 'cast-desktop', startedAt: '2026-05-10T10:00:00Z', model: 'claude-sonnet-4-6-20260320', costUsd: 0.25 },
  { id: 'bbb-222', project: 'cast-desktop', startedAt: '2026-05-09T08:00:00Z', model: 'claude-haiku-4-5-20251001',  costUsd: 0.12 },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockGetJsonlTokenTotals.mockReturnValue(MOCK_TOTALS)
  mockGetModelBreakdown.mockReturnValue(MOCK_BY_MODEL)
  mockGetTopSessions.mockReturnValue(MOCK_TOP_SESSIONS)
})

describe('GET /cast/cost-summary', () => {
  it('returns the correct response shape on the happy path', async () => {
    const res = await request(buildApp()).get('/cast/cost-summary/')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      totals: MOCK_TOTALS,
      byModel: MOCK_BY_MODEL,
      topSessions: MOCK_TOP_SESSIONS,
      windowDays: 30,
    })
  })

  it('returns zero totals and empty arrays when no sessions', async () => {
    mockGetJsonlTokenTotals.mockReturnValue(EMPTY_TOTALS)
    mockGetModelBreakdown.mockReturnValue([])
    mockGetTopSessions.mockReturnValue([])

    const res = await request(buildApp()).get('/cast/cost-summary/')
    expect(res.status).toBe(200)
    expect(res.body.totals.costUsd).toBe(0)
    expect(res.body.totals.sessionCount).toBe(0)
    expect(res.body.byModel).toHaveLength(0)
    expect(res.body.topSessions).toHaveLength(0)
  })

  it('passes the since date derived from the ?days param to utilities', async () => {
    const res = await request(buildApp()).get('/cast/cost-summary/?days=7')
    expect(res.status).toBe(200)
    expect(res.body.windowDays).toBe(7)

    // since arg passed to utilities should be a YYYY-MM-DD 7 days ago
    const since = mockGetJsonlTokenTotals.mock.calls[0][0] as string
    expect(since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const sinceDate = new Date(since)
    const expectedDate = new Date()
    expectedDate.setDate(expectedDate.getDate() - 7)
    // Allow ±1 day for clock drift in test execution
    expect(Math.abs(sinceDate.getTime() - expectedDate.getTime())).toBeLessThan(2 * 24 * 60 * 60 * 1000)
  })

  it('passes the top limit to getTopSessions', async () => {
    await request(buildApp()).get('/cast/cost-summary/?top=5')
    const topArg = mockGetTopSessions.mock.calls[0][1] as number
    expect(topArg).toBe(5)
  })

  it('returns 500 when utility throws', async () => {
    mockGetJsonlTokenTotals.mockImplementation(() => {
      throw new Error('read error')
    })
    const res = await request(buildApp()).get('/cast/cost-summary/')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})
