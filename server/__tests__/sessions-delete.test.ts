/**
 * Tests for DELETE /api/sessions/:projectEncoded/:sessionId (soft-delete, write-layer Phase 4)
 *
 * Strategy:
 * - Mock listSessions/loadSession (no filesystem dependency for GET /)
 * - Mock getCastDb / getCastDbWritable (no cast.db on CI)
 * - Use a real temp .jsonl file to satisfy the fs.existsSync check in DELETE handler
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ── Stable test session ID (valid v4 UUID format) ─────────────────────────────
const SESSION_ID = '12345678-1234-4abc-8def-123456789012'

// ── Temp project directory for the fake .jsonl file ──────────────────────────
const TEMP_PROJECT = `test-project-${process.pid}`
const TEMP_PROJECT_DIR = path.join(os.homedir(), '.claude', 'projects', TEMP_PROJECT)
const SESSION_FILE = path.join(TEMP_PROJECT_DIR, `${SESSION_ID}.jsonl`)

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockRun = vi.fn()
const mockPrepare = vi.fn(() => ({ run: mockRun }))
const mockDb = { prepare: mockPrepare, exec: vi.fn(), close: vi.fn() }

vi.mock('../routes/castDb.js', () => ({
  getCastDb: vi.fn(() => null),
  getCastDbWritable: vi.fn(() => mockDb),
}))

// Mock parsers/sessions to avoid real FS in GET / handler
vi.mock('../parsers/sessions.js', () => ({
  listSessions: vi.fn(() => []),
  loadSession: vi.fn(() => []),
}))

// Import router AFTER mocks
const { sessionsRouter } = await import('../routes/sessions.js')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sessions', sessionsRouter)
  return app
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(() => {
  fs.mkdirSync(TEMP_PROJECT_DIR, { recursive: true })
  fs.writeFileSync(SESSION_FILE, '', 'utf-8')
})

afterEach(() => {
  vi.clearAllMocks()
  // Recreate the file after each delete test so subsequent tests still have it
  try {
    fs.mkdirSync(TEMP_PROJECT_DIR, { recursive: true })
    if (!fs.existsSync(SESSION_FILE)) {
      fs.writeFileSync(SESSION_FILE, '', 'utf-8')
    }
  } catch { /* ignore */ }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DELETE /api/sessions/:projectEncoded/:sessionId', () => {
  it('returns 404 for a non-existent session ID', async () => {
    const app = buildApp()
    const nonExistent = '00000000-0000-4000-a000-000000000000'
    const res = await request(app)
      .delete(`/api/sessions/${TEMP_PROJECT}/${nonExistent}`)
    expect(res.status).toBe(404)
  })

  it('returns 400 for an invalid session ID format', async () => {
    const app = buildApp()
    const res = await request(app)
      .delete(`/api/sessions/${TEMP_PROJECT}/not-a-uuid`)
    expect(res.status).toBe(400)
  })

  it('returns 200 and sets deleted_at for an existing session', async () => {
    const app = buildApp()
    const res = await request(app)
      .delete(`/api/sessions/${TEMP_PROJECT}/${SESSION_ID}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', SESSION_ID)
    expect(res.body).toHaveProperty('deleted_at')
    // deleted_at should be a valid ISO date
    expect(() => new Date(res.body.deleted_at as string)).not.toThrow()
    // DB prepare was called with the upsert
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions')
    )
    expect(mockRun).toHaveBeenCalledWith(SESSION_ID, expect.any(String))
  })

  it('GET /api/sessions does not include soft-deleted sessions', async () => {
    // listSessions is mocked to return [] so no deleted sessions show up
    const app = buildApp()
    const res = await request(app).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const ids = (res.body as Array<{ id: string }>).map(s => s.id)
    expect(ids).not.toContain(SESSION_ID)
  })
})
