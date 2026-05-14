/**
 * Tests for server/routes/files.ts
 *
 * Covers:
 * 1. GET /touches — requires path param
 * 2. GET /touches — rejects relative paths
 * 3. GET /touches — returns [] when DB missing
 * 4. GET /touches — returns [] when file_writes table absent
 * 5. GET /touches — returns rows when table and data present
 * 6. GET /plans/files — returns [] when PLANS_DIR missing
 * 7. GET /plans/files — returns paths from pending plans
 * 8. extractAbsolutePaths — plan-done detection skips all-done plans
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// ── Mock getCastDb ─────────────────────────────────────────────────────────────

vi.mock('../routes/castDb.js', () => ({
  getCastDb: vi.fn(),
  getCastDbWritable: vi.fn(),
}))

// ── Mock PLANS_DIR constant ────────────────────────────────────────────────────

let mockPlansDir = path.join(os.tmpdir(), `cast-test-plans-${process.pid}`)

vi.mock('../constants.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants.js')>()
  return {
    ...actual,
    get PLANS_DIR() {
      return mockPlansDir
    },
  }
})

import { getCastDb } from '../routes/castDb.js'
import { filesRouter, getPlanPendingFiles, _resetPlanFilesCache } from '../routes/files.js'

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/api/files', filesRouter)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockDb(rows: unknown[], tableExists: boolean) {
  const prepareMap: Record<string, { get: () => unknown; all: () => unknown }> = {
    "SELECT name FROM sqlite_master WHERE type='table' AND name='file_writes'": {
      get: () => (tableExists ? { name: 'file_writes' } : undefined),
      all: () => [],
    },
    'SELECT agent_name, tool_name, ts, run_id, line_range FROM file_writes WHERE file_path = ? ORDER BY ts DESC LIMIT 50': {
      get: () => undefined,
      all: () => rows,
    },
  }
  return {
    prepare: (sql: string) => prepareMap[sql] ?? { get: () => undefined, all: () => [] },
  }
}

// ── Unit 1: GET /api/files/touches ────────────────────────────────────────────

describe('GET /api/files/touches', () => {
  beforeEach(() => {
    vi.mocked(getCastDb).mockReturnValue(null)
  })

  it('returns 400 when path is missing', async () => {
    const res = await request(app).get('/api/files/touches')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 for a relative path', async () => {
    const res = await request(app).get('/api/files/touches?path=relative/path.ts')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/absolute/)
  })

  it('returns [] (200) when DB is unavailable', async () => {
    vi.mocked(getCastDb).mockReturnValue(null)
    const res = await request(app).get('/api/files/touches?path=/Users/ed/foo.ts')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns [] (200) when file_writes table does not exist', async () => {
    vi.mocked(getCastDb).mockReturnValue(makeMockDb([], false) as ReturnType<typeof getCastDb>)
    const res = await request(app).get('/api/files/touches?path=/Users/ed/foo.ts')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns rows when table exists and has data', async () => {
    const mockRows = [
      { agent_name: 'code-writer', tool_name: 'write_file', ts: '2026-05-14T10:00:00Z', run_id: 'abc123', line_range: null },
    ]
    vi.mocked(getCastDb).mockReturnValue(makeMockDb(mockRows, true) as ReturnType<typeof getCastDb>)
    const res = await request(app).get('/api/files/touches?path=/Users/ed/foo.ts')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].agent_name).toBe('code-writer')
    expect(res.body[0].ts).toBe('2026-05-14T10:00:00Z')
  })

  it('returns [] (200) when DB throws an error', async () => {
    vi.mocked(getCastDb).mockReturnValue({
      prepare: () => { throw new Error('DB exploded') },
    } as ReturnType<typeof getCastDb>)
    const res = await request(app).get('/api/files/touches?path=/Users/ed/foo.ts')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

// ── Unit 2: GET /api/files/plan-pending-files + getPlanPendingFiles ──────────

describe('GET /api/files/plan-pending-files', () => {
  beforeEach(() => {
    _resetPlanFilesCache()
    if (fs.existsSync(mockPlansDir)) {
      fs.rmSync(mockPlansDir, { recursive: true })
    }
    fs.mkdirSync(mockPlansDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(mockPlansDir)) {
      fs.rmSync(mockPlansDir, { recursive: true })
    }
    _resetPlanFilesCache()
  })

  it('returns 200 [] when plans dir is empty', async () => {
    const res = await request(app).get('/api/files/plan-pending-files')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual([])
  })

  it('returns paths from pending plans (has unchecked boxes)', () => {
    _resetPlanFilesCache()
    const planContent = [
      '# My Plan',
      '',
      '- [ ] Task 1',
      '- [x] Task 2',
      '',
      'Working on /Users/ed/project/src/foo.ts and /Users/ed/project/bar.ts',
    ].join('\n')
    fs.writeFileSync(path.join(mockPlansDir, 'test-plan.md'), planContent)

    const result = getPlanPendingFiles()
    expect(result.has('/Users/ed/project/src/foo.ts')).toBe(true)
    expect(result.has('/Users/ed/project/bar.ts')).toBe(true)
  })

  it('excludes paths from all-done plans', () => {
    _resetPlanFilesCache()
    const planContent = [
      '# Done Plan',
      '',
      '- [x] Task 1',
      '- [x] Task 2',
      '',
      'Completed /Users/ed/project/done.ts',
    ].join('\n')
    fs.writeFileSync(path.join(mockPlansDir, 'done-plan.md'), planContent)

    const result = getPlanPendingFiles()
    expect(result.has('/Users/ed/project/done.ts')).toBe(false)
  })

  it('includes paths from plans with no checkboxes (treated as pending)', () => {
    _resetPlanFilesCache()
    const planContent = [
      '# No Checkbox Plan',
      '',
      'Working on /Users/ed/project/src/no-check.ts',
    ].join('\n')
    fs.writeFileSync(path.join(mockPlansDir, 'no-check-plan.md'), planContent)

    const result = getPlanPendingFiles()
    expect(result.has('/Users/ed/project/src/no-check.ts')).toBe(true)
  })

  it('returns 200 [] when PLANS_DIR does not exist', async () => {
    _resetPlanFilesCache()
    fs.rmSync(mockPlansDir, { recursive: true })
    const res = await request(app).get('/api/files/plan-pending-files')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
