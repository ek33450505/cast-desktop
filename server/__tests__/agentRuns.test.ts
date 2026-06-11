/**
 * Tests for liveAgentsRouter in server/routes/agentRuns.ts (Wave 2.6)
 *
 * Covers:
 * 1. GET /running — returns running agents with correct shape
 * 2. GET /running — returns empty array when no running rows
 * 3. GET /running — returns empty array when no sessionId param
 * 4. GET /runs/:id — returns full detail for valid agentRunId
 * 5. GET /runs/:id — returns 404 for nonexistent agentRunId
 * 6. GET /stream — SSE connection establishes and sends initial snapshot
 * 7. Route ordering: /running and /stream are not captured by /runs/:id
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

import { liveAgentsRouter } from '../routes/agentRuns.js'

function buildApp() {
  const app = express()
  app.use('/agents', liveAgentsRouter)
  return app
}

function makeRunningRow(overrides: Partial<{
  id: string; session_id: string; agent: string; model: string;
  started_at: string; ended_at: string | null; status: string;
  input_tokens: number; output_tokens: number; cost_usd: number;
}> = {}) {
  return {
    id: 'run-1',
    session_id: 'sess-abc',
    agent: 'code-writer',
    model: 'claude-sonnet-4-6',
    started_at: new Date(Date.now() - 30_000).toISOString(),
    ended_at: null,
    status: 'running',
    input_tokens: 1200,
    output_tokens: 800,
    cost_usd: 0.0012,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /agents/running', () => {
  it('returns running agents with correct shape when rows present', async () => {
    const row = makeRunningRow()
    mockPrepare.mockReturnValue({ all: vi.fn(() => [row]) })

    const app = buildApp()
    const res = await request(app).get('/agents/running?sessionId=sess-abc')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('agents')
    expect(Array.isArray(res.body.agents)).toBe(true)
    expect(res.body.agents).toHaveLength(1)

    const agent = res.body.agents[0]
    expect(agent).toMatchObject({
      agentRunId: 'run-1',
      name: 'code-writer',
      model: 'claude-sonnet-4-6',
      startedAt: row.started_at,
      tokenCount: 2000, // 1200 + 800
    })
    // prompt field is no longer emitted (task_summary was 100% NULL in live DB)
    expect(agent).not.toHaveProperty('prompt')
  })

  it('returns empty agents array when no running rows', async () => {
    mockPrepare.mockReturnValue({ all: vi.fn(() => []) })

    const app = buildApp()
    const res = await request(app).get('/agents/running?sessionId=sess-xyz')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ agents: [] })
  })

  it('returns empty agents array when no sessionId provided', async () => {
    const app = buildApp()
    const res = await request(app).get('/agents/running')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ agents: [] })
    // Should NOT call DB when sessionId is missing
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('does not include prompt field in running agent response', async () => {
    const row = makeRunningRow()
    mockPrepare.mockReturnValue({ all: vi.fn(() => [row]) })

    const app = buildApp()
    const res = await request(app).get('/agents/running?sessionId=sess-abc')

    expect(res.status).toBe(200)
    expect(res.body.agents[0]).not.toHaveProperty('prompt')
  })

  it('handles null model gracefully', async () => {
    const row = makeRunningRow({ model: null as unknown as string })
    mockPrepare.mockReturnValue({ all: vi.fn(() => [row]) })

    const app = buildApp()
    const res = await request(app).get('/agents/running?sessionId=sess-abc')

    expect(res.status).toBe(200)
    expect(res.body.agents[0].model).toBe('unknown')
  })

  it('returns empty array when DB is null', async () => {
    mockGetCastDb.mockReturnValueOnce(null as unknown as typeof mockDb)

    const app = buildApp()
    const res = await request(app).get('/agents/running?sessionId=sess-abc')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ agents: [] })
  })
})

describe('GET /agents/runs/:agentRunId', () => {
  it('returns full detail for valid agentRunId', async () => {
    const row = makeRunningRow({ status: 'DONE', ended_at: new Date().toISOString() })
    mockPrepare.mockReturnValue({ get: vi.fn(() => row) })

    const app = buildApp()
    const res = await request(app).get('/agents/runs/run-1')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      agentRunId: 'run-1',
      name: 'code-writer',
      model: 'claude-sonnet-4-6',
      status: 'DONE',
      inputTokens: 1200,
      outputTokens: 800,
      costUsd: 0.0012,
    })
    // prompt field is no longer emitted (task_summary was 100% NULL in live DB)
    expect(res.body).not.toHaveProperty('prompt')
  })

  it('returns 404 for nonexistent agentRunId', async () => {
    mockPrepare.mockReturnValue({ get: vi.fn(() => undefined) })

    const app = buildApp()
    const res = await request(app).get('/agents/runs/nonexistent-id')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 404 when DB is null', async () => {
    mockGetCastDb.mockReturnValueOnce(null as unknown as typeof mockDb)

    const app = buildApp()
    const res = await request(app).get('/agents/runs/run-1')

    expect(res.status).toBe(404)
  })
})

describe('GET /agents/stream — SSE smoke test', () => {
  // /agents/stream was removed in Wave 2.13 SSE multiplex refactor.
  // Events are now delivered via the single /api/events SseManager endpoint.
  // The test below validates that the surviving /running route is still correctly
  // ordered and not captured by the /runs/:agentRunId param route.

  it('route /running is not captured by /runs/:agentRunId', async () => {
    // This test verifies the route ordering invariant:
    // /running must resolve as a named route, not as a param capture
    mockPrepare.mockReturnValue({ all: vi.fn(() => []) })

    const app = buildApp()
    const res = await request(app).get('/agents/running?sessionId=sess-abc')

    // Should return agents shape, not a 404 from param route
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('agents')
  })
})
