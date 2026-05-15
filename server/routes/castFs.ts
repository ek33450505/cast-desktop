import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  CLAUDE_DIR,
  AGENTS_DIR,
  SKILLS_DIR,
  RULES_DIR,
  PLANS_DIR,
  COMMANDS_DIR,
  BRIEFINGS_DIR,
  REPORTS_DIR,
  SCRIPTS_DIR,
  RESEARCH_DIR,
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

function readScriptItems(dir: string): FsItem[] {
  try {
    return fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.sh') || f.endsWith('.py') || f.endsWith('.md'))
      .map(f => {
        const full = path.join(dir, f)
        const stat = fs.statSync(full)
        return { name: f, path: full, mtime: stat.mtimeMs }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/**
 * Reads skills as directories — each skill is a subdirectory with a SKILL.md inside.
 * Returns items with name = subdirName and path = <subdir>/SKILL.md.
 */
function readSkillItems(dir: string): FsItem[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const results: FsItem[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillMd = path.join(dir, entry.name, 'SKILL.md')
      try {
        const stat = fs.statSync(skillMd)
        results.push({ name: entry.name, path: skillMd, mtime: stat.mtimeMs })
      } catch { /* SKILL.md missing — skip */ }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
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

// ── shared tree types ────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  mtime: number
  size: number
  children?: TreeNode[]
}

const CLAUDE_ROOT = path.resolve(os.homedir(), '.claude')
const CLAUDE_ROOT_PREFIX = CLAUDE_ROOT + path.sep

// ── /tree — recursive lazy filesystem tree of ~/.claude/ ─────────────────────

/**
 * Resolves `rawPath` within the CLAUDE_ROOT boundary.
 * Mirrors the security pattern from projectFs.ts.
 */
function safeCastResolve(rawPath: string): string | null {
  const resolved = path.resolve(rawPath)
  // Allow the root itself (CLAUDE_ROOT) or anything inside it
  if (resolved !== CLAUDE_ROOT && !resolved.startsWith(CLAUDE_ROOT_PREFIX)) return null
  let real: string
  try {
    real = fs.realpathSync(resolved)
  } catch {
    real = resolved
  }
  if (real !== CLAUDE_ROOT && !real.startsWith(CLAUDE_ROOT_PREFIX)) return null
  return real
}

/**
 * GET /tree?dir=<encoded>
 *
 * Returns ONE level of children (lazy — client expands folders on demand).
 * Default dir when none provided: ~/.claude/
 * Skip patterns mirror projectFs.ts; dotfiles are NOT skipped because the
 * entire vault lives under a dotfile dir (all useful content would be hidden).
 */
router.get('/tree', (req, res) => {
  const rawDir = req.query['dir']
  const targetDir = (typeof rawDir === 'string' && rawDir)
    ? safeCastResolve(rawDir)
    : CLAUDE_ROOT

  if (!targetDir) {
    res.status(403).json({ error: 'path outside allowed root' })
    return
  }

  try {
    const stat = fs.statSync(targetDir)
    if (stat.isFile()) {
      const node: TreeNode = {
        name: path.basename(targetDir),
        path: targetDir,
        type: 'file',
        mtime: stat.mtimeMs,
        size: stat.size,
      }
      res.json(node)
      return
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true })
    const children: TreeNode[] = []

    for (const entry of entries) {
      // Skip heavy build / cache artifacts
      if (entry.name === 'node_modules') continue
      if (entry.name === 'dist' || entry.name === 'build') continue
      if (entry.name === 'coverage' || entry.name === '__pycache__') continue
      if (entry.name === 'target') continue
      // Do NOT skip dotfiles — contents of ~/.claude/ are all useful

      const full = path.join(targetDir, entry.name)
      try {
        const s = fs.statSync(full)
        children.push({
          name: entry.name,
          path: full,
          type: entry.isDirectory() ? 'dir' : 'file',
          mtime: s.mtimeMs,
          size: s.size,
        })
      } catch { /* skip unreadable entries */ }
    }

    // Dirs first, then files — both sorted by name
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    const node: TreeNode = {
      name: path.basename(targetDir) || targetDir,
      path: targetDir,
      type: 'dir',
      mtime: stat.mtimeMs,
      size: stat.size,
      children,
    }
    res.json(node)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      res.status(404).json({ error: 'directory not found' })
    } else {
      res.status(500).json({ error: 'failed to read directory' })
    }
  }
})

// ── routes ───────────────────────────────────────────────────────────────────

router.get('/agents', (_req, res) => {
  res.json(readDirItems(AGENTS_DIR))
})

router.get('/skills', (_req, res) => {
  res.json(readSkillItems(SKILLS_DIR))
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

router.get('/research', (_req, res) => {
  res.json(readDirItems(RESEARCH_DIR))
})

router.get('/briefings', (_req, res) => {
  res.json(readDirItems(BRIEFINGS_DIR))
})

router.get('/reports', (_req, res) => {
  res.json(readDirItems(REPORTS_DIR))
})

router.get('/scripts', (_req, res) => {
  res.json(readScriptItems(SCRIPTS_DIR))
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

export { router as castFsRouter }
