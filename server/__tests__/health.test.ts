import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { healthRouter } from '../routes/health.js'

const app = express()
app.use(express.json())
app.use('/api/health', healthRouter)

describe('GET /api/health', () => {
  it('returns status 200', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
  })

  it('returns body.status === "ok"', async () => {
    const res = await request(app).get('/api/health')
    expect((res.body as { status: string }).status).toBe('ok')
  })

  it('returns a valid ISO timestamp in body.timestamp', async () => {
    const res = await request(app).get('/api/health')
    const { timestamp } = res.body as { timestamp: string }
    expect(typeof timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false)
  })
})
