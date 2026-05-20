import { createRequire } from 'module'

// Provides a SQLite Database class that works in both runtimes:
//   Bun compiled binary → uses built-in bun:sqlite (no native addon needed)
//   Node/tsx/Vitest    → falls back to better-sqlite3
const _require = createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any
try {
  Database = _require('bun:sqlite').Database
} catch {
  Database = _require('better-sqlite3')
}

export default Database as typeof import('better-sqlite3').default
