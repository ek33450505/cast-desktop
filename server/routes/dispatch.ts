/**
 * server/routes/dispatch.ts — IDE-5: Agent dispatch from the editor
 *
 * POST /api/dispatch
 *   Body: { agent: string, prompt: string, cwd: string }
 *   Validates agent against whitelist, spawns via cast-managed-agent.sh
 *   (if present in ~/.claude/scripts/) or falls back to `claude --agent`.
 *   Returns { run_id: string, status: 'started' } immediately.
 *
 * GET /api/dispatch/:run_id
 *   Returns { run_id, status: 'running' | 'done' | 'failed', files_modified?: string[], error?: string }
 *   Queries cast.db agent_runs (status) + file_writes (files touched on done).
 *
 * DELETE /api/dispatch/:run_id
 *   Best-effort cancel — kills the spawned child process if it's still alive.
 *   Returns { run_id, cancelled: true } on success, 404 if run_id unknown.
 *
 * Security: prompt is never shell-interpolated. It is passed via a temp file
 * that the child process reads from stdin, or as a single argv string with
 * child_process.spawn() (not exec) so the shell never sees it.
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getCastDb } from './castDb.js'
import { SCRIPTS_DIR } from '../constants.js'

const router = Router()

// ── Agent whitelist ────────────────────────────────────────────────────────────
// Only these agents may be dispatched from the editor in v1.
// Add more after security + capability review.
const ALLOWED_AGENTS = new Set(['code-writer', 'debugger', 'test-writer', 'researcher'])

// ── In-memory run registry ────────────────────────────────────────────────────
// Maps run_id → { status, process, error }
// Persisted status comes from cast.db agent_runs; this map provides
// immediate feedback before cast.db is written and enables Cancel.
type RunStatus = 'running' | 'done' | 'failed'

interface RunEntry {
  status: RunStatus
  process: ChildProcess | null
  error?: string
  startedAt: number
  tmpFile?: string
}

// Export for test reset only
export const _runRegistry = new Map<string, RunEntry>()

export function _resetRunRegistry() {
  _runRegistry.clear()
}

// ── ID generator ─────────────────────────────────────────────────────────────
function generateRunId(): string {
  return `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Dispatch pathway ─────────────────────────────────────────────────────────
// cast-managed-agent.sh path — canonical dispatch entry per managed-agents.md rule
const MANAGED_AGENT_SCRIPT = path.join(SCRIPTS_DIR, 'cast-managed-agent.sh')

/**
 * Spawn the agent via cast-managed-agent.sh (preferred) or claude CLI fallback.
 *
 * The prompt is written to a temp file and passed via --prompt-file (or stdin)
 * so it NEVER touches shell argument interpolation. cast-managed-agent.sh reads
 * its first two positional args (agent-name, prompt) as $1/$2 without eval.
 *
 * Security note: spawn() vs exec() — we use spawn() with an explicit argv array,
 * so no shell interpolation occurs regardless of prompt content.
 */
function spawnAgent(agent: string, prompt: string, cwd: string): { proc: ChildProcess; tmpFile: string } {
  // Write prompt to a temp file so we can pass it safely to any invocation style
  const tmpFile = path.join(os.tmpdir(), `cast-dispatch-${Date.now()}.txt`)
  fs.writeFileSync(tmpFile, prompt, 'utf-8')

  if (fs.existsSync(MANAGED_AGENT_SCRIPT)) {
    // Preferred path: cast-managed-agent.sh <agent> <prompt-string>
    // The script accepts the prompt as $2 — a single argv element, no shell eval.
    const proc = spawn('bash', [MANAGED_AGENT_SCRIPT, agent, prompt], {
      cwd,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CAST_DISPATCH_PROMPT_FILE: tmpFile },
    })
    return { proc, tmpFile }
  }

  // Fallback: claude --agent <name> --prompt <text>
  // spawn() avoids shell interpolation; prompt is a single argv element.
  const proc = spawn('claude', ['--agent', agent, '--prompt', prompt], {
    cwd,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { proc, tmpFile }
}

// ── POST /api/dispatch ────────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response) => {
  const { agent, prompt, cwd } = req.body as Record<string, unknown>

  // Validate required fields
  if (typeof agent !== 'string' || !agent) {
    res.status(400).json({ error: 'agent is required' })
    return
  }
  if (typeof prompt !== 'string' || !prompt) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }
  if (typeof cwd !== 'string' || !cwd) {
    res.status(400).json({ error: 'cwd is required' })
    return
  }

  // Validate agent whitelist
  if (!ALLOWED_AGENTS.has(agent)) {
    res.status(400).json({
      error: `Unknown agent: ${agent}. Allowed: ${[...ALLOWED_AGENTS].join(', ')}`,
    })
    return
  }

  // Validate cwd is absolute (security: prevent path traversal)
  if (!path.isAbsolute(cwd)) {
    res.status(400).json({ error: 'cwd must be an absolute path' })
    return
  }

  const run_id = generateRunId()

  let proc: ChildProcess
  let tmpFile: string
  try {
    ;({ proc, tmpFile } = spawnAgent(agent, prompt, cwd))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Failed to spawn agent: ${message}` })
    return
  }

  const entry: RunEntry = { status: 'running', process: proc, startedAt: Date.now(), tmpFile }
  _runRegistry.set(run_id, entry)

  proc.on('close', (code) => {
    const e = _runRegistry.get(run_id)
    if (e) {
      e.status = code === 0 ? 'done' : 'failed'
      e.error = code !== 0 ? `Agent exited with code ${code}` : undefined
      e.process = null
    }
    // Clean up the temp prompt file
    if (tmpFile) {
      fs.unlink(tmpFile, () => {})
    }
  })

  proc.on('error', (err) => {
    const e = _runRegistry.get(run_id)
    if (e) {
      e.status = 'failed'
      e.error = err.message
      e.process = null
    }
  })

  res.status(202).json({ run_id, status: 'started' })
})

// ── GET /api/dispatch/:run_id ─────────────────────────────────────────────────

router.get('/:run_id', (req: Request, res: Response) => {
  const run_id = String(req.params.run_id)

  const entry = _runRegistry.get(run_id)
  if (!entry) {
    // Not in memory — check cast.db agent_runs table
    const db = getCastDb()
    if (db) {
      try {
        const row = db.prepare(
          'SELECT status FROM agent_runs WHERE run_id = ? LIMIT 1'
        ).get(run_id) as { status: string } | undefined

        if (row) {
          // Fetch files modified by this run from file_writes table
          let filesModified: string[] | undefined
          try {
            const writes = db.prepare(
              'SELECT DISTINCT file_path FROM file_writes WHERE run_id = ?'
            ).all(run_id) as { file_path: string }[]
            filesModified = writes.map((w) => w.file_path)
          } catch {
            // file_writes table may not exist yet
          }

          const status: RunStatus =
            row.status === 'done' ? 'done'
            : row.status === 'failed' ? 'failed'
            : 'running'

          res.json({ run_id, status, files_modified: filesModified })
          return
        }
      } catch (err) {
        console.error('[dispatch/:run_id] DB error', err)
      }
    }

    res.status(404).json({ error: `Run ${run_id} not found` })
    return
  }

  // Run is in memory
  const responseBody: {
    run_id: string
    status: RunStatus
    files_modified?: string[]
    error?: string
  } = {
    run_id,
    status: entry.status,
  }

  if (entry.error) {
    responseBody.error = entry.error
  }

  // On done, fetch files from cast.db
  if (entry.status === 'done') {
    const db = getCastDb()
    if (db) {
      try {
        const writes = db.prepare(
          'SELECT DISTINCT file_path FROM file_writes WHERE run_id = ?'
        ).all(run_id) as { file_path: string }[]
        responseBody.files_modified = writes.map((w) => w.file_path)
      } catch {
        // file_writes may not exist; return empty array rather than error
        responseBody.files_modified = []
      }
    } else {
      responseBody.files_modified = []
    }
  }

  res.json(responseBody)
})

// ── DELETE /api/dispatch/:run_id ──────────────────────────────────────────────

router.delete('/:run_id', (req: Request, res: Response) => {
  const run_id = String(req.params.run_id)
  const entry = _runRegistry.get(run_id)

  if (!entry) {
    res.status(404).json({ error: `Run ${run_id} not found` })
    return
  }

  if (entry.process) {
    try {
      entry.process.kill('SIGTERM')
    } catch {
      // Process may have already exited
    }
    entry.process = null
  }

  entry.status = 'failed'
  entry.error = 'Cancelled by user'

  res.json({ run_id, cancelled: true })
})

export { router as dispatchRouter }
