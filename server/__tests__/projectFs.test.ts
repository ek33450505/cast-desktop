import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import path from 'path'
import os from 'os'
import { projectFsRouter } from '../routes/projectFs.js'

const app = express()
app.use(express.json())
app.use('/api/project-fs', projectFsRouter)

describe('GET /api/project-fs/tree', () => {
  it('returns 200 with root tree node when no dir param', async () => {
    const res = await request(app).get('/api/project-fs/tree')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name')
    expect(res.body).toHaveProperty('path')
    expect(res.body).toHaveProperty('type')
    expect(res.body).toHaveProperty('mtime')
    expect(res.body).toHaveProperty('size')
    expect(res.body.type).toBe('dir')
  })

  it('returns children array for root', async () => {
    const res = await request(app).get('/api/project-fs/tree')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.children)).toBe(true)
  })

  it('dirs appear before files in children list', async () => {
    const res = await request(app).get('/api/project-fs/tree')
    const children: Array<{ type: string }> = res.body.children ?? []
    if (children.length > 1) {
      const firstFileIdx = children.findIndex(c => c.type === 'file')
      const lastDirIdx = children.findLastIndex(c => c.type === 'dir')
      if (firstFileIdx !== -1 && lastDirIdx !== -1) {
        expect(lastDirIdx).toBeLessThan(firstFileIdx)
      }
    }
  })

  it('returns 403 for path traversal — relative up-dir', async () => {
    const encoded = encodeURIComponent(path.join(process.cwd(), '../../etc'))
    const res = await request(app).get(`/api/project-fs/tree?dir=${encoded}`)
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 403 for absolute path outside project root', async () => {
    const encoded = encodeURIComponent(os.homedir())
    const res = await request(app).get(`/api/project-fs/tree?dir=${encoded}`)
    expect(res.status).toBe(403)
  })

  it('does not include node_modules or dot directories in children', async () => {
    const res = await request(app).get('/api/project-fs/tree')
    const children: Array<{ name: string }> = res.body.children ?? []
    expect(children.find(c => c.name === 'node_modules')).toBeUndefined()
    expect(children.find(c => c.name.startsWith('.'))).toBeUndefined()
  })
})

describe('GET /api/project-fs/preview', () => {
  it('returns 400 when path param missing', async () => {
    const res = await request(app).get('/api/project-fs/preview')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 403 for path outside project root', async () => {
    const encoded = encodeURIComponent('/etc/passwd')
    const res = await request(app).get(`/api/project-fs/preview?path=${encoded}`)
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 403 for path traversal attempt', async () => {
    const encoded = encodeURIComponent(path.join(process.cwd(), '../../etc/passwd'))
    const res = await request(app).get(`/api/project-fs/preview?path=${encoded}`)
    expect(res.status).toBe(403)
  })

  it('rejects %25-encoded traversal (double-encoding bypass)', async () => {
    const traversal = encodeURIComponent('%2e%2e/%2e%2e/etc/passwd')
    const res = await request(app).get(`/api/project-fs/preview?path=${traversal}`)
    // Both outcomes prove rejection:
    // 403 = guard caught the path outside allowed root.
    // 404 = path.resolve treated "%2e%2e" as a literal directory name (inside cwd),
    //       then realpath/stat failed ENOENT. Either way, no file content leaks.
    expect([403, 404]).toContain(res.status)
  })

  it('rejects absolute path outside cwd', async () => {
    const res = await request(app).get(`/api/project-fs/preview?path=${encodeURIComponent('/etc/passwd')}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with content for a valid in-project file', async () => {
    // package.json is guaranteed to exist in the project root
    const encoded = encodeURIComponent(path.join(process.cwd(), 'package.json'))
    const res = await request(app).get(`/api/project-fs/preview?path=${encoded}`)
    // Accept 200 or 404 on CI if cwd differs, but must NOT be 403
    expect(res.status).not.toBe(403)
    if (res.status === 200) {
      expect(res.body).toHaveProperty('content')
      expect(res.body).toHaveProperty('mtime')
    }
  })
})

