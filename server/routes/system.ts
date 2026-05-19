import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'

const router = Router()

router.get('/cast-status', (_req, res) => {
  const dbPath = path.join(os.homedir(), '.claude', 'cast.db')
  const dbExists = fs.existsSync(dbPath)
  let dbHasData = false
  if (dbExists) {
    try {
      const db = new Database(dbPath, { readonly: true })
      const row = db.prepare('SELECT COUNT(*) as n FROM sessions').get() as { n: number }
      dbHasData = row.n > 0
      db.close()
    } catch {
      dbHasData = false
    }
  }
  res.json({ castInstalled: dbExists, dbExists, dbHasData, dbPath })
})

export default router
