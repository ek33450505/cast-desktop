import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'

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
    // The sqlite-shim uses createRequire('better-sqlite3') which bypasses vi.mock.
    // Use a real temp SQLite file with an empty sessions table so CAST_DB_PATH override
    // works through the shim's CJS require path. Never touches ~/.claude/cast.db.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: RealDb } = await vi.importActual<any>('better-sqlite3')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-sys-empty-'))
    const tmpPath = path.join(tmpDir, 'test.db')
    const tmpDb = new RealDb(tmpPath)
    tmpDb.exec('CREATE TABLE sessions (id INTEGER PRIMARY KEY)')
    tmpDb.close()

    process.env.CAST_DB_PATH = tmpPath
    vi.resetModules()

    try {
      const { default: isolatedRouter } = await import('../routes/system.js')
      const isolatedApp = express()
      isolatedApp.use(express.json())
      isolatedApp.use('/api/system', isolatedRouter)

      const res = await request(isolatedApp).get('/api/system/cast-status')

      expect(res.status).toBe(200)
      expect(res.body.castInstalled).toBe(true)
      expect(res.body.dbExists).toBe(true)
      expect(res.body.dbHasData).toBe(false)
    } finally {
      delete process.env.CAST_DB_PATH
      fs.rmSync(tmpDir, { recursive: true })
    }
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
    // The sqlite-shim uses createRequire('better-sqlite3') which bypasses vi.mock.
    // Use a real temp SQLite file that has NO sessions table so the SELECT query
    // throws "no such table", which the route catches and maps to dbHasData:false.
    // Never touches ~/.claude/cast.db.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: RealDb } = await vi.importActual<any>('better-sqlite3')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-sys-throw-'))
    const tmpPath = path.join(tmpDir, 'test.db')
    const tmpDb = new RealDb(tmpPath)
    // Intentionally create NO tables — SELECT COUNT(*) FROM sessions will throw
    tmpDb.close()

    process.env.CAST_DB_PATH = tmpPath
    vi.resetModules()

    try {
      const { default: isolatedRouter } = await import('../routes/system.js')
      const isolatedApp = express()
      isolatedApp.use(express.json())
      isolatedApp.use('/api/system', isolatedRouter)

      const res = await request(isolatedApp).get('/api/system/cast-status')

      expect(res.status).toBe(200)
      expect(res.body.castInstalled).toBe(true)
      expect(res.body.dbExists).toBe(true)
      expect(res.body.dbHasData).toBe(false)
    } finally {
      delete process.env.CAST_DB_PATH
      fs.rmSync(tmpDir, { recursive: true })
    }
  })
})
