import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chokidar from 'chokidar'
import type { Response } from 'express'
import {
  CLAUDE_DIR,
  AGENTS_DIR,
  SKILLS_DIR,
  RULES_DIR,
  PLANS_DIR,
  COMMANDS_DIR,
  SETTINGS_GLOBAL_FILE,
} from '../constants.js'

const router = Router()

const PROJECTS_MEMORY_DIR = path.join(CLAUDE_DIR, 'projects')
const ALLOWED_ROOT = path.resolve(os.homedir(), '.claude') + path.sep

// ── shared types ─────────────────────────────────────────────────────────────

interface FsItem {
  name: string
  path: string
  mtime: number
}

interface MemoryItem extends FsItem {
  projectId: string
}

interface HookItem {
  event: string
  script: string
  enabled: boolean
}

interface McpItem {
  name: string
  command: string
  args: string[]
}

// ── security helper ──────────────────────────────────────────────────────────

/**
 * Returns the resolved, realpath'd absolute path, or null if it falls outside
 * `~/.claude/` (path traversal guard).
 */
function safeResolve(rawPath: string): string | null {
  // Express has already decoded req.query.path once via qs. Do NOT re-decode —
  // that enables %25 double-encoding bypass (%252e%252e → %2e%2e → ..).
  const resolved = path.resolve(rawPath)
  if (!resolved.startsWith(ALLOWED_ROOT)) return null
  // Follow symlinks and re-check
  let real: string
  try {
    real = fs.realpathSync(resolved)
  } catch {
    // File may not exist yet — fall back to resolved
    real = resolved
  }
  if (!real.startsWith(ALLOWED_ROOT)) return null
  return real
}

// ── helpers ──────────────────────────────────────────────────────────────────

function readDirItems(dir: string): FsItem[] {
  try {
    return fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const full = path.join(dir, f)
        const stat = fs.statSync(full)
        return {
          name: path.basename(f, '.md'),
          path: full,
          mtime: stat.mtimeMs,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

function readMemoryItems(): MemoryItem[] {
  const results: MemoryItem[] = []
  try {
    if (!fs.existsSync(PROJECTS_MEMORY_DIR)) return results
    for (const projectDir of fs.readdirSync(PROJECTS_MEMORY_DIR)) {
      const memDir = path.join(PROJECTS_MEMORY_DIR, projectDir, 'memory')
      if (!fs.existsSync(memDir)) continue
      try {
        for (const file of fs.readdirSync(memDir)) {
          if (!file.endsWith('.md')) continue
          const full = path.join(memDir, file)
          try {
            const stat = fs.statSync(full)
            results.push({
              name: path.basename(file, '.md'),
              path: full,
              projectId: projectDir,
              mtime: stat.mtimeMs,
            })
          } catch { /* skip stat failures */ }
        }
      } catch { /* skip unreadable memory dirs */ }
    }
  } catch { /* skip unreadable projects dir */ }
  return results.sort((a, b) => a.name.localeCompare(b.name))
}

type HooksRecord = Record<string, Array<{ hooks?: Array<{ type?: string; command?: string }> } | string>>

function readHookItems(): HookItem[] {
  try {
    if (!fs.existsSync(SETTINGS_GLOBAL_FILE)) return []
    const raw = fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8')
    const settings = JSON.parse(raw) as { hooks?: HooksRecord }
    if (!settings.hooks || typeof settings.hooks !== 'object') return []
    const items: HookItem[] = []
    for (const [event, matchers] of Object.entries(settings.hooks)) {
      if (!Array.isArray(matchers)) continue
      for (const matcher of matchers) {
        if (typeof matcher === 'string') {
          items.push({ event, script: matcher, enabled: true })
        } else if (matcher && typeof matcher === 'object' && 'hooks' in matcher && Array.isArray(matcher.hooks)) {
          for (const hook of matcher.hooks) {
            if (hook && typeof hook === 'object' && hook.command) {
              items.push({ event, script: hook.command, enabled: true })
            }
          }
        }
      }
    }
    return items
  } catch {
    return []
  }
}

interface McpServerConfig {
  command?: string
  args?: string[]
}

function readMcpItems(): McpItem[] {
  try {
    if (!fs.existsSync(SETTINGS_GLOBAL_FILE)) return []
    const raw = fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8')
    const settings = JSON.parse(raw) as { mcpServers?: Record<string, McpServerConfig> }
    if (!settings.mcpServers || typeof settings.mcpServers !== 'object') return []
    return Object.entries(settings.mcpServers).map(([name, conf]) => ({
      name,
      command: conf.command ?? '',
      args: Array.isArray(conf.args) ? conf.args : [],
    }))
  } catch {
    return []
  }
}

// ── routes ───────────────────────────────────────────────────────────────────

router.get('/agents', (_req, res) => {
  res.json(readDirItems(AGENTS_DIR))
})

router.get('/skills', (_req, res) => {
  res.json(readDirItems(SKILLS_DIR))
})

router.get('/rules', (_req, res) => {
  res.json(readDirItems(RULES_DIR))
})

router.get('/plans', (_req, res) => {
  res.json(readDirItems(PLANS_DIR))
})

router.get('/commands', (_req, res) => {
  res.json(readDirItems(COMMANDS_DIR))
})

router.get('/memory', (_req, res) => {
  res.json(readMemoryItems())
})

router.get('/hooks', (_req, res) => {
  res.json(readHookItems())
})

router.get('/mcp', (_req, res) => {
  res.json(readMcpItems())
})

const MAX_PREVIEW_SIZE = 2 * 1024 * 1024 // 2 MB

router.get('/preview', (req, res) => {
  const rawPath = req.query['path']
  if (typeof rawPath !== 'string' || !rawPath) {
    res.status(400).json({ error: 'path query param required' })
    return
  }

  const safePath = safeResolve(rawPath)
  if (!safePath) {
    res.status(403).json({ error: 'path outside allowed root' })
    return
  }

  try {
    const stat = fs.statSync(safePath)
    if (stat.size > MAX_PREVIEW_SIZE) {
      res.status(413).json({ error: 'file too large' })
      return
    }
    const content = fs.readFileSync(safePath, 'utf-8')
    res.json({ path: safePath, content, mtime: stat.mtimeMs })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      res.status(404).json({ error: 'file not found' })
    } else {
      res.status(500).json({ error: 'failed to read file' })
    }
  }
})

// ── SSE stream ───────────────────────────────────────────────────────────────

const WATCHED_DIRS = [
  AGENTS_DIR,
  SKILLS_DIR,
  RULES_DIR,
  PLANS_DIR,
  COMMANDS_DIR,
  PROJECTS_MEMORY_DIR,
  SETTINGS_GLOBAL_FILE,
]

function sectionFromPath(filePath: string): string {
  if (filePath.startsWith(AGENTS_DIR)) return 'agents'
  if (filePath.startsWith(SKILLS_DIR)) return 'skills'
  if (filePath.startsWith(RULES_DIR)) return 'rules'
  if (filePath.startsWith(PLANS_DIR)) return 'plans'
  if (filePath.startsWith(COMMANDS_DIR)) return 'commands'
  if (filePath.startsWith(PROJECTS_MEMORY_DIR)) return 'memory'
  if (filePath === SETTINGS_GLOBAL_FILE) return 'hooks'
  return 'unknown'
}

router.get('/stream', (req, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const watcher = chokidar.watch(WATCHED_DIRS, {
    persistent: false,
    ignoreInitial: true,
    depth: 2,
    ignored: (p: string) => {
      // Under projects dir, only watch */memory/*.md
      if (p.startsWith(PROJECTS_MEMORY_DIR)) {
        const rel = p.slice(PROJECTS_MEMORY_DIR.length + 1)
        const parts = rel.split(path.sep)
        // allow: projectId/memory/*.md (3 parts) or projectId/memory (2 parts) or projectId (1 part)
        if (parts.length > 3) return true
        if (parts.length === 2 && parts[1] !== 'memory') return true
        if (parts.length === 3 && parts[1] !== 'memory') return true
      }
      return false
    },
  })

  const send = (event: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`)
  }

  for (const evt of ['add', 'change', 'unlink'] as const) {
    watcher.on(evt, (filePath: string) => {
      const section = sectionFromPath(filePath)
      const name = path.basename(filePath, '.md')
      send(evt, { section, name, path: filePath })
    })
  }

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 30_000)

  req.on('close', () => {
    clearInterval(keepAlive)
    watcher.close()
  })
})

export { router as castFsRouter }
