/**
 * tempV8Db.ts — helpers for integration tests that need a real v8 cast.db schema.
 *
 * Unit B (drift-guard) uses `it.skipIf(!v8InitAvailable())` so CI without the
 * claude-agent-team framework degrades gracefully (skips, does NOT fail).
 *
 * Usage:
 *   import { v8InitAvailable, buildTempV8Db, cleanupTempDb } from './helpers/tempV8Db.js'
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync, spawnSync } from 'child_process'

// Allow overriding the init script path via env so CI can point at a checked-out clone.
export const CAST_DB_INIT_SH =
  process.env.CAST_DB_INIT_SH ||
  '/Users/edkubiak/Projects/personal/claude-agent-team/scripts/cast-db-init.sh'

/**
 * Returns true only if:
 *   - `sqlite3` is on PATH, AND
 *   - the cast-db-init.sh script exists on disk.
 *
 * Unit B guards every test with `it.skipIf(!v8InitAvailable())`.
 */
export function v8InitAvailable(): boolean {
  try {
    const result = spawnSync('which', ['sqlite3'], { encoding: 'utf8' })
    if (result.status !== 0 || !result.stdout.trim()) return false
  } catch {
    return false
  }
  return fs.existsSync(CAST_DB_INIT_SH)
}

/**
 * Boots the framework's cast-db-init.sh into a unique temp file and returns the path.
 * The resulting DB has PRAGMA user_version=8 and all v8 tables.
 *
 * Throws a descriptive error if the prerequisites are missing.
 */
export function buildTempV8Db(): string {
  if (!v8InitAvailable()) {
    throw new Error(
      `buildTempV8Db: prerequisites missing — ` +
        `sqlite3 not on PATH or init script not found at ${CAST_DB_INIT_SH}`
    )
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `cast-v8-${process.pid}-${Date.now()}.db`
  )

  execFileSync('bash', [CAST_DB_INIT_SH], {
    env: { ...process.env, CAST_DB_PATH: tmpPath },
  })

  return tmpPath
}

/**
 * Unlinks the temp DB and any WAL/SHM sidecars.
 * Swallows ENOENT so it is safe to call unconditionally in afterEach.
 */
export function cleanupTempDb(p: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(p + suffix)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
}
