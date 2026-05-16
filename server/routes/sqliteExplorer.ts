import { Router } from 'express'
import type { Database } from 'better-sqlite3'
import { getCastDb } from './castDb.js'

export const sqliteExplorerRouter = Router()

/**
 * Returns all non-FTS-shadow tables from sqlite_master, sorted by name.
 * FTS5 creates shadow tables matching patterns: *_fts*, *_content*, *_data*, *_idx*.
 * These are excluded to avoid exposing internal SQLite implementation details.
 */
function getAllowedTables(db: Database): string[] {
  return db.prepare(
    `SELECT name FROM sqlite_master
     WHERE type='table'
       AND name NOT LIKE '%_fts%'
       AND name NOT LIKE '%_content%'
       AND name NOT LIKE '%_data%'
       AND name NOT LIKE '%_idx%'
     ORDER BY name`
  ).pluck().all() as string[]
}

sqliteExplorerRouter.get('/tables', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ tables: [] })
    }
    const allowed = getAllowedTables(db)

    const tables = allowed.map(name => {
      const countRow = db.prepare(`SELECT COUNT(*) AS total FROM "${name}"`).get() as { total: number }
      return { name, rowCount: countRow.total }
    })

    res.json({ tables })
  } catch (err) {
    console.error('SQLite explorer tables error:', err)
    res.status(500).json({ error: 'Failed to list tables' })
  }
})

sqliteExplorerRouter.get('/schema/:table', (req, res) => {
  const { table } = req.params

  try {
    const db = getCastDb()
    if (!db) {
      return res.status(500).json({ error: 'Database unavailable' })
    }

    const allowed = getAllowedTables(db)
    if (!allowed.includes(table)) {
      return res.status(404).json({ error: `Table '${table}' not found` })
    }

    const schema = db.prepare(`PRAGMA table_info("${table}")`).all()
    res.json(schema)
  } catch (err) {
    console.error('SQLite explorer schema error:', err)
    res.status(500).json({ error: 'Failed to get schema' })
  }
})

sqliteExplorerRouter.get('/:table', (req, res) => {
  const { table } = req.params

  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ columns: [], rows: [], total: 0, nullColumns: [] })
    }

    const allowed = getAllowedTables(db)
    if (!allowed.includes(table)) {
      return res.status(404).json({ error: `Table '${table}' not found` })
    }

    const rawLimit = Number(req.query.limit) || 50
    const limit = Math.min(rawLimit, 200)
    const offset = Number(req.query.offset) || 0

    const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }

    // Get column metadata from PRAGMA
    const pragmaRows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; pk: number }>
    const columns = pragmaRows.map(r => r.name)

    // Build ORDER BY clause:
    // 1. If ?sort param is provided, validate it against known columns and use it
    // 2. Otherwise fall back to ordering by integer pk named 'id' if it exists
    let orderClause = ''
    const { sort, dir } = req.query

    if (sort) {
      if (!columns.includes(sort as string)) {
        return res.status(400).json({ error: `Invalid sort column: '${sort}'` })
      }
      const safeDir = dir === 'desc' ? 'DESC' : 'ASC'
      orderClause = `ORDER BY "${sort as string}" ${safeDir}`
    } else {
      const hasPkId = pragmaRows.some(r => r.name === 'id' && r.pk === 1)
      if (hasPkId) {
        orderClause = 'ORDER BY "id" DESC'
      }
    }

    const rows = db.prepare(
      `SELECT * FROM "${table}" ${orderClause} LIMIT ? OFFSET ?`
    ).all(limit, offset) as Array<Record<string, unknown>>

    // Compute which columns are ALL NULL across returned rows
    const nullColumns: string[] = rows.length > 0
      ? columns.filter(col => rows.every(row => row[col] === null || row[col] === undefined))
      : []

    res.json({ columns, rows, total: totalRow.total, nullColumns })
  } catch (err) {
    console.error('SQLite explorer table error:', err)
    res.status(500).json({ error: 'Failed to query table' })
  }
})
