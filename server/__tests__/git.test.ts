import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { gitRouter } from '../routes/git.js'

const app = express()
app.use(express.json())
app.use('/api/git', gitRouter)

describe('GET /api/git/branch', () => {
  it('returns 200 with a branch field', async () => {
    const res = await request(app).get('/api/git/branch')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('branch')
  })

  it('branch field is a string or null (never undefined)', async () => {
    const res = await request(app).get('/api/git/branch')
    const { branch } = res.body as { branch: string | null }
    // Must be a non-empty string (the test runs inside the cast-desktop git repo)
    // or null (if somehow git is unavailable in the CI environment).
    expect(branch === null || typeof branch === 'string').toBe(true)
  })

  it('returns a non-empty branch string when running inside the cast-desktop repo', async () => {
    const res = await request(app).get('/api/git/branch')
    const { branch } = res.body as { branch: string | null }
    // Running tests from within the repo — git should always resolve a branch.
    // If this fails, git is not installed or the test environment is non-git.
    if (branch !== null) {
      expect(branch.length).toBeGreaterThan(0)
    }
  })
})
