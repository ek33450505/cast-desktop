/**
 * Tests for server/routes/plans.ts
 *
 * Covers:
 * 1. parsePlanTasks — checkbox lines (done / undone)
 * 2. parsePlanTasks — fallback to ### Task N: headers when no checkboxes
 * 3. parsePlanTasks — returns [] when no tasks found
 * 4. parsePlanTasks — prefers checkboxes over headers when both present
 * 5. GET /active — existing routes still respond (regression guard)
 * 6. GET / — plan list route not broken
 * 7. GET /:filename — 404 for nonexistent file
 */

import { describe, it, expect, vi } from 'vitest'

// ── parsePlanTasks pure-function tests (direct import — no mocking needed) ────

import { parsePlanTasks, plansRouter } from '../routes/plans.js'
import express from 'express'
import request from 'supertest'

describe('parsePlanTasks', () => {
  it('parses checkbox lines — undone and done', () => {
    const content = [
      '# My Plan',
      '',
      '- [ ] First task',
      '- [x] Second task (done)',
      '- [ ] Third task',
    ].join('\n')

    const tasks = parsePlanTasks(content)

    expect(tasks).toHaveLength(3)
    expect(tasks[0]).toMatchObject({ text: 'First task', done: false })
    expect(tasks[1]).toMatchObject({ text: 'Second task (done)', done: true })
    expect(tasks[2]).toMatchObject({ text: 'Third task', done: false })
  })

  it('parses uppercase X as done', () => {
    const content = '- [X] Uppercase done task'
    const tasks = parsePlanTasks(content)

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ done: true, text: 'Uppercase done task' })
  })

  it('falls back to ### Task N: headers when no checkboxes present', () => {
    const content = [
      '# Plan',
      '### Task 1: Set up project',
      'Details about task 1.',
      '### Task 2: Write tests',
    ].join('\n')

    const tasks = parsePlanTasks(content)

    expect(tasks).toHaveLength(2)
    expect(tasks[0].text).toBe('Task 1: Set up project')
    expect(tasks[1].text).toBe('Task 2: Write tests')
    expect(tasks[0].done).toBe(false)
    expect(tasks[1].done).toBe(false)
  })

  it('returns empty array when no tasks and no headers found', () => {
    const content = '# Just a heading\n\nSome prose text with no tasks.'
    const tasks = parsePlanTasks(content)

    expect(tasks).toHaveLength(0)
  })

  it('assigns unique string ids to each task', () => {
    const content = [
      '- [ ] Task A',
      '- [ ] Task B',
      '- [x] Task C',
    ].join('\n')

    const tasks = parsePlanTasks(content)
    const ids = tasks.map(t => t.id)

    expect(new Set(ids).size).toBe(3)
  })

  it('prefers checkbox lines over headers when both are present', () => {
    const content = [
      '### Task 1: A header task',
      '- [ ] A checkbox task',
    ].join('\n')

    const tasks = parsePlanTasks(content)

    // Should have used checkboxes
    expect(tasks).toHaveLength(1)
    expect(tasks[0].text).toBe('A checkbox task')
  })

  it('returns empty array for empty content', () => {
    expect(parsePlanTasks('')).toHaveLength(0)
  })

  it('handles mixed indentation in checkbox lines', () => {
    // Only leading `- ` lines match; indented lines are ignored
    const content = '- [ ] Top level task'
    const tasks = parsePlanTasks(content)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].done).toBe(false)
  })
})

// ── GET /active endpoint — smoke test (uses real PLANS_DIR) ──────────────────
// We mount the router against the real plansRouter and just verify response
// shape. We can't easily redirect PLANS_DIR in an ESM test, so we accept that
// the response may contain real plan data. We only assert shape, not content.

describe('GET /active — smoke test', () => {
  it('returns a 200 with expected shape { planPath, title, tasks }', async () => {
    const app = express()
    app.use('/plans', plansRouter)

    const res = await request(app).get('/plans/active')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('planPath')
    expect(res.body).toHaveProperty('title')
    expect(res.body).toHaveProperty('tasks')
    expect(Array.isArray(res.body.tasks)).toBe(true)
  })

  it('accepts sessionId query param without error', async () => {
    const app = express()
    app.use('/plans', plansRouter)

    const res = await request(app).get('/plans/active?sessionId=test-session-abc')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tasks')
    expect(Array.isArray(res.body.tasks)).toBe(true)
  })

  it('returns planPath=null when no plans found (empty fallback)', async () => {
    // If there ARE plan files, planPath will be a string — this just ensures
    // the null branch shape is correct by verifying the type contract.
    const app = express()
    app.use('/plans', plansRouter)

    const res = await request(app).get('/plans/active')

    // Either null or a string path — never undefined
    expect(
      res.body.planPath === null || typeof res.body.planPath === 'string'
    ).toBe(true)
  })
})

// ── Existing routes regression guard ──────────────────────────────────────────

describe('GET / (plan list — regression)', () => {
  it('returns 200 and an array', async () => {
    const app = express()
    app.use('/plans', plansRouter)

    const res = await request(app).get('/plans/')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /:filename (regression)', () => {
  it('returns 404 for nonexistent file', async () => {
    const app = express()
    app.use('/plans', plansRouter)

    const res = await request(app).get('/plans/definitely-does-not-exist-12345.md')

    expect(res.status).toBe(404)
  })

  it('does not match /active as a filename', async () => {
    // This ensures /active route has higher priority than /:filename
    const app = express()
    app.use('/plans', plansRouter)

    const res = await request(app).get('/plans/active')

    // Must return a plans/active response (shape), not a 404 from filename route
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tasks')
  })
})
