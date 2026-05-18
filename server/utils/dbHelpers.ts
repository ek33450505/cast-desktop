import { getCastDb } from '../routes/castDb.js'

type CastDb = NonNullable<ReturnType<typeof getCastDb>>

/**
 * Run `fn` only if cast.db is available and `tableName` exists.
 * Returns `fallback` immediately otherwise.
 */
export function withTable<T>(tableName: string, fallback: T, fn: (db: CastDb) => T): T {
  const db = getCastDb()
  if (!db) return fallback
  const exists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName)
  if (!exists) return fallback
  return fn(db)
}
