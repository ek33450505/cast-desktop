import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import path from 'path'
import os from 'os'
import { castFsRouter } from '../routes/castFs.js'

const app = express()
app.use(express.json())
app.use('/api/cast-fs', castFsRouter)

describe('GET /api/cast-fs/agents', () => {
  it('returns an array of items with {name, path, mtime} shape', async () => {
    const res = await request(app).get('/api/cast-fs/agents')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('name')
      expect(res.body[0]).toHaveProperty('path')
      expect(res.body[0]).toHaveProperty('mtime')
    }
  })
})

describe('GET /api/cast-fs/skills', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/cast-fs/skills')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/cast-fs/rules', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/cast-fs/rules')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/cast-fs/plans', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/cast-fs/plans')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/cast-fs/commands', () => {
  it('returns empty array if directory missing or array if present', async () => {
    const res = await request(app).get('/api/cast-fs/commands')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/cast-fs/memory', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/cast-fs/memory')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/cast-fs/hooks', () => {
  it('returns [] or array of {event, script, enabled}', async () => {
    const res = await request(app).get('/api/cast-fs/hooks')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('event')
      expect(res.body[0]).toHaveProperty('script')
      expect(res.body[0]).toHaveProperty('enabled')
    }
  })
})

describe('GET /api/cast-fs/mcp', () => {
  it('returns [] or array of {name, command, args}', async () => {
    const res = await request(app).get('/api/cast-fs/mcp')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('name')
      expect(res.body[0]).toHaveProperty('command')
      expect(res.body[0]).toHaveProperty('args')
    }
  })
})

describe('GET /api/cast-fs/preview', () => {
  it('returns 403 when path is /etc/passwd', async () => {
    const res = await request(app).get('/api/cast-fs/preview?path=/etc/passwd')
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 403 for path traversal attempt', async () => {
    const encoded = encodeURIComponent(path.join(os.homedir(), '.claude', '../../etc/passwd'))
    const res = await request(app).get(`/api/cast-fs/preview?path=${encoded}`)
    expect(res.status).toBe(403)
  })

  it('rejects %25-encoded traversal attempts (double-encoding bypass)', async () => {
    // %252e%252e encodes to %2e%2e after Express qs decode, which would then
    // resolve to .. if we double-decoded. Fix 1 removes the extra decodeURIComponent.
    const traversal = encodeURIComponent('%2e%2e/%2e%2e/etc/passwd')
    const res = await request(app).get(`/api/cast-fs/preview?path=${traversal}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with content for settings.json when it exists', async () => {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
    const encoded = encodeURIComponent(settingsPath)
    const res = await request(app).get(`/api/cast-fs/preview?path=${encoded}`)
    // File may not exist on CI — accept 200 or 404, not 403
    expect([200, 404]).toContain(res.status)
    if (res.status === 200) {
      expect(res.body).toHaveProperty('content')
      // Content should be parseable JSON
      expect(() => JSON.parse(res.body.content as string)).not.toThrow()
    }
  })

  it('returns 400 when path param is missing', async () => {
    const res = await request(app).get('/api/cast-fs/preview')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/cast-fs/stream', () => {
  it('route is registered (smoke test via direct handler inspection)', () => {
    // SSE streams indefinitely and chokidar watchers EMFILE in test runners.
    // Instead we verify the route handler exists by checking the router stack.
    const stack = (castFsRouter as unknown as { stack: Array<{ route?: { path?: string } }> }).stack
    const streamRoute = stack.find(layer => layer.route?.path === '/stream')
    expect(streamRoute).toBeTruthy()
  })
})
