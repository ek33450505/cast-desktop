import { describe, it, expect, afterEach, beforeEach } from 'vitest'
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
  it('returns an array of skill items with path ending in SKILL.md', async () => {
    const res = await request(app).get('/api/cast-fs/skills')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    if (res.body.length > 0) {
      // Skills are directories — path must point to the SKILL.md inside each
      expect(res.body[0]).toHaveProperty('name')
      expect(res.body[0]).toHaveProperty('path')
      expect(res.body[0]).toHaveProperty('mtime')
      expect((res.body[0] as { path: string }).path).toMatch(/SKILL\.md$/)
    }
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
    // %252e%252e encodes to %2e%2e after Express qs decode. Express does not
    // re-decode the inner %2e sequences, so the path arrives as a literal
    // "%2e%2e/..." string that doesn't exist on disk → 404.
    // 404 is safe — no traversal bypass. 403 would require defense-in-depth
    // %2e detection that is not currently implemented.
    const traversal = encodeURIComponent('%2e%2e/%2e%2e/etc/passwd')
    const res = await request(app).get(`/api/cast-fs/preview?path=${traversal}`)
    // 404 is safe; 403 would mean active defense-in-depth detection was added
    expect([403, 404]).toContain(res.status)
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

// /api/cast-fs/stream removed in Wave 2.13 SSE multiplex refactor.
// FS change events are now broadcast via the single /api/events SseManager endpoint.

// ── write / delete / read routes (write-layer, Phase 4) ──────────────────────

import fsSync from 'fs'

describe('POST /api/cast-fs/write', () => {
  const testPath = path.join(os.homedir(), '.claude', `test-tmp-${process.pid}.md`)

  afterEach(() => {
    try { fsSync.unlinkSync(testPath) } catch { /* already gone */ }
  })

  it('writes a file inside ~/.claude and returns 200', async () => {
    const res = await request(app)
      .post('/api/cast-fs/write')
      .send({ path: testPath, content: 'x' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('path')
    expect(fsSync.existsSync(testPath)).toBe(true)
    expect(fsSync.readFileSync(testPath, 'utf-8')).toBe('x')
  })

  it('returns 403 when path is /etc/passwd', async () => {
    const res = await request(app)
      .post('/api/cast-fs/write')
      .send({ path: '/etc/passwd', content: 'evil' })
    expect(res.status).toBe(403)
  })

  it('returns 403 for tilde-expansion path traversal (~/.claude/../../etc/passwd)', async () => {
    const res = await request(app)
      .post('/api/cast-fs/write')
      .send({ path: '~/.claude/../../etc/passwd', content: 'evil' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when path is missing', async () => {
    const res = await request(app)
      .post('/api/cast-fs/write')
      .send({ content: 'x' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when content is missing', async () => {
    const res = await request(app)
      .post('/api/cast-fs/write')
      .send({ path: testPath })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/cast-fs/delete', () => {
  const testPath = path.join(os.homedir(), '.claude', `test-tmp-del-${process.pid}.md`)

  afterEach(() => {
    try { fsSync.unlinkSync(testPath) } catch { /* already gone */ }
  })

  it('returns 404 for a non-existent file', async () => {
    const res = await request(app)
      .delete('/api/cast-fs/delete')
      .send({ path: testPath })
    expect(res.status).toBe(404)
  })

  it('deletes a real file and returns 200 with path', async () => {
    fsSync.writeFileSync(testPath, 'to-delete', 'utf-8')
    const res = await request(app)
      .delete('/api/cast-fs/delete')
      .send({ path: testPath })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('path')
    expect(fsSync.existsSync(testPath)).toBe(false)
  })

  it('returns 403 for path outside ~/.claude', async () => {
    const res = await request(app)
      .delete('/api/cast-fs/delete')
      .send({ path: '/etc/passwd' })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/cast-fs/write — symlink bypass', () => {
  const symlinkPath = path.join(os.homedir(), '.claude', `test-symlink-${process.pid}`)

  afterEach(() => {
    try { fsSync.unlinkSync(symlinkPath) } catch { /* already gone */ }
  })

  it('returns 403 when path points through a symlink that escapes ~/.claude', async () => {
    // Create a symlink inside ~/.claude that points to /tmp/
    try {
      fsSync.symlinkSync('/tmp', symlinkPath)
    } catch {
      // If symlink creation fails (permissions etc.), skip test
      return
    }
    const escapePath = path.join(symlinkPath, 'escape.txt')
    const res = await request(app)
      .post('/api/cast-fs/write')
      .send({ path: escapePath, content: 'evil' })
    expect(res.status).toBe(403)
    // Ensure no file was written to /tmp/escape.txt
    expect(fsSync.existsSync('/tmp/escape.txt')).toBe(false)
  })
})

describe('GET /api/cast-fs/read', () => {
  const testPath = path.join(os.homedir(), '.claude', `test-tmp-read-${process.pid}.md`)

  beforeEach(() => {
    fsSync.writeFileSync(testPath, '# test content', 'utf-8')
  })

  afterEach(() => {
    try { fsSync.unlinkSync(testPath) } catch { /* already gone */ }
  })

  it('returns 200 with content for a valid file in ~/.claude', async () => {
    const encoded = encodeURIComponent(testPath)
    const res = await request(app).get(`/api/cast-fs/read?path=${encoded}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content', '# test content')
    expect(res.body).toHaveProperty('path')
  })

  it('returns 403 for path outside ~/.claude', async () => {
    const encoded = encodeURIComponent('/etc/passwd')
    const res = await request(app).get(`/api/cast-fs/read?path=${encoded}`)
    expect(res.status).toBe(403)
  })

  it('returns 400 when path param is missing', async () => {
    const res = await request(app).get('/api/cast-fs/read')
    expect(res.status).toBe(400)
  })
})
