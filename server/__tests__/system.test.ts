import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'

// ── better-sqlite3 mock ───────────────────────────────────────────────────────
// vi.mock is hoisted to top of file, so we declare the mock fn via vi.hoisted
// so it's available in the factory before the outer let bindings initialize.
const { mockClose, mockGet, mockPrepare, MockDatabase } = vi.hoisted(() => {
  const mockClose = vi.fn()
  const mockGet = vi.fn()
  const mockPrepare = vi.fn(() => ({ get: mockGet }))
  const MockDatabase = vi.fn(() => ({ prepare: mockPrepare, close: mockClose }))
  return { mockClose, mockGet, mockPrepare, MockDatabase }
})

vi.mock('better-sqlite3', () => ({ default: MockDatabase }))

import systemRouter from '../routes/system.js'

const app = express()
app.use(express.json())
app.use('/api/system', systemRouter)

describe('GET /api/system/cast-status', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    existsSyncSpy = vi.spyOn(fs, 'existsSync')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns castInstalled:false when db file does not exist', async () => {
    existsSyncSpy.mockReturnValue(false)

    const res = await request(app).get('/api/system/cast-status')

    expect(res.status).toBe(200)
    expect(res.body.castInstalled).toBe(false)
    expect(res.body.dbExists).toBe(false)
    expect(res.body.dbHasData).toBe(false)
    expect(typeof res.body.dbPath).toBe('string')
    expect(res.body.dbPath).toContain('.claude')
  })

  it('returns castInstalled:true and dbHasData:false when db file exists but sessions table is empty', async () => {
    existsSyncSpy.mockReturnValue(true)
    mockGet.mockReturnValue({ n: 0 })

    const res = await request(app).get('/api/system/cast-status')

    expect(res.status).toBe(200)
    expect(res.body.castInstalled).toBe(true)
    expect(res.body.dbExists).toBe(true)
    expect(res.body.dbHasData).toBe(false)
  })

  it('returns castInstalled:true and dbHasData:true when db has rows', async () => {
    existsSyncSpy.mockReturnValue(true)
    mockGet.mockReturnValue({ n: 5 })

    const res = await request(app).get('/api/system/cast-status')

    expect(res.status).toBe(200)
    expect(res.body.castInstalled).toBe(true)
    expect(res.body.dbExists).toBe(true)
    expect(res.body.dbHasData).toBe(true)
  })

  it('returns dbHasData:false when better-sqlite3 throws', async () => {
    existsSyncSpy.mockReturnValue(true)
    MockDatabase.mockImplementationOnce(() => { throw new Error('db locked') })

    const res = await request(app).get('/api/system/cast-status')

    expect(res.status).toBe(200)
    expect(res.body.castInstalled).toBe(true)
    expect(res.body.dbExists).toBe(true)
    expect(res.body.dbHasData).toBe(false)
  })
})
