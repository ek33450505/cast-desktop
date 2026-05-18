import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { TreeNode, safeResolve } from '../utils/fsHelpers.js'

const router = Router()

// ── allowed root ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(process.cwd())

/**
 * Returns a default-safe dir when the caller passes none.
 * Falls back to PROJECT_ROOT itself.
 */
function resolveDir(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return PROJECT_ROOT
  return safeResolve(PROJECT_ROOT, raw)
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

  const safePath = safeResolve(PROJECT_ROOT, rawPath)
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

export { router as projectFsRouter }
