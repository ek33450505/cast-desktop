import { Router } from 'express'
import { execSync } from 'node:child_process'

export const gitRouter = Router()

/**
 * GET /api/git/branch
 *
 * Returns the current git branch for the project root (CAST_PROJECT_ROOT env or
 * process.cwd() as fallback). Returns { branch: null } when git is unavailable or
 * the cwd is not a git repository.
 */
gitRouter.get('/branch', (_req, res) => {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: process.env.CAST_PROJECT_ROOT || process.cwd(),
      encoding: 'utf8',
      timeout: 2000,
    }).trim()
    res.json({ branch })
  } catch {
    res.json({ branch: null })
  }
})

/**
 * GET /api/git/user
 *
 * Returns the git global user.name. Returns { name: null } when git config is
 * unavailable or user.name is not set.
 */
gitRouter.get('/user', (_req, res) => {
  try {
    const name = execSync('git config --global user.name', {
      encoding: 'utf8',
      timeout: 2000,
    }).trim()
    res.json({ name: name || null })
  } catch {
    res.json({ name: null })
  }
})
