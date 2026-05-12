import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import type { Response } from 'express'

const router = Router()

// ── allowed root ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(process.cwd()) + path.sep

// ── types ─────────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  mtime: number
  size: number
  children?: TreeNode[]
}

// ── security helper ───────────────────────────────────────────────────────────

/**
 * Resolves and validates that `rawPath` is within the project root.
 * Returns the real path or null on violation.
 *
 * Mirrors the `safeResolve` pattern from castFs.ts:
 *   - Do NOT re-decode (Express qs already decoded once — double-decode enables
 *     %252e%252e → %2e%2e → .. bypass).
 *   - Resolve, then realpath, then prefix-check against PROJECT_ROOT.
 */
function safeResolve(rawPath: string): string | null {
  const resolved = path.resolve(rawPath)
  if (!resolved.startsWith(PROJECT_ROOT)) return null
  let real: string
  try {
    real = fs.realpathSync(resolved)
  } catch {
    real = resolved
  }
  if (!real.startsWith(PROJECT_ROOT)) return null
  return real
}

/**
 * Returns a default-safe dir when the caller passes none.
 * Falls back to PROJECT_ROOT itself.
 */
function resolveDir(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return PROJECT_ROOT.slice(0, -1)
  return safeResolve(raw)
}

// ── routes ────────────────────────────────────────────────────────────────────

/**
 * GET /tree?dir=<encoded>
 *
 * Returns ONE level of children (lazy — client expands folders on demand).
 * Shape: { name, path, type, mtime, size, children: undefined }
 * If dir is a file, returns that single node.
 */
router.get('/tree', (req, res) => {
  const safeDir = resolveDir(req.query['dir'])
  if (!safeDir) {
    res.status(403).json({ error: 'path outside allowed root' })
    return
  }

  try {
    const stat = fs.statSync(safeDir)
    if (stat.isFile()) {
      const node: TreeNode = {
        name: path.basename(safeDir),
        path: safeDir,
        type: 'file',
        mtime: stat.mtimeMs,
        size: stat.size,
      }
      res.json(node)
      return
    }

    const entries = fs.readdirSync(safeDir, { withFileTypes: true })
    const children: TreeNode[] = []

    for (const entry of entries) {
      // Skip hidden files/dirs, node_modules, .git etc.
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'node_modules') continue
      if (entry.name === 'dist' || entry.name === 'build') continue
      if (entry.name === 'coverage' || entry.name === '__pycache__') continue
      if (entry.name === 'target') continue

      const full = path.join(safeDir, entry.name)
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

    // Dirs first, then files, both sorted by name
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    const node: TreeNode = {
      name: path.basename(safeDir) || safeDir,
      path: safeDir,
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

const MAX_PREVIEW_SIZE = 2 * 1024 * 1024 // 2 MB

/**
 * GET /preview?path=<encoded>
 *
 * Same as castFs/preview but allowed root is process.cwd().
 */
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

// ── SSE stream ────────────────────────────────────────────────────────────────

const CHOKIDAR_IGNORED = [
  /(^|[/\\])\../,       // dotfiles
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /target/,
  /coverage/,
  /\.next/,
  /__pycache__/,
]

/**
 * GET /stream
 *
 * SSE: emits { event: 'change'|'add'|'unlink', path, dir } on file changes.
 * `dir` = parent folder — client can invalidate just that folder's query.
 *
 * Debounces SSE emits by folder + 250ms to avoid storms during npm install etc.
 */
router.get('/stream', (req, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const watcher = chokidar.watch(PROJECT_ROOT.slice(0, -1), {
    persistent: false,
    ignoreInitial: true,
    depth: 4,
    ignored: CHOKIDAR_IGNORED,
  })

  // Debounce per-folder events to coalesce storms (e.g. npm install)
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  const sendEvent = (evt: string, filePath: string) => {
    const dir = path.dirname(filePath)
    const key = `${evt}:${dir}`
    const existing = pending.get(key)
    if (existing) clearTimeout(existing)
    pending.set(key, setTimeout(() => {
      pending.delete(key)
      res.write(`data: ${JSON.stringify({ event: evt, path: filePath, dir })}\n\n`)
    }, 250))
  }

  for (const evt of ['add', 'change', 'unlink'] as const) {
    watcher.on(evt, (filePath: string) => sendEvent(evt, filePath))
  }

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 30_000)

  req.on('close', () => {
    clearInterval(keepAlive)
    for (const t of pending.values()) clearTimeout(t)
    pending.clear()
    watcher.close()
  })
})

export { router as projectFsRouter }
