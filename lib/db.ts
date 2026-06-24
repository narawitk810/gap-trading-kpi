import { createClient, type Client } from '@libsql/client'
import path from 'path'
import fs from 'fs'

const g = globalThis as unknown as { db: Client | undefined; dbReady: boolean }

function createDb(): Client {
  const url = process.env.TURSO_DATABASE_URL
  // Local file mode — ensure data directory exists
  if (!url || url.startsWith('file:')) {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  }
  return createClient({
    url: url || `file:${path.join(process.cwd(), 'data/kpi.db')}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

export function getDb(): Client {
  if (!g.db) {
    g.db = createDb()
    g.dbReady = false
  }
  return g.db
}

export async function ensureSchema(): Promise<void> {
  if (g.dbReady) return
  const db = getDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kpi_entries (
      id          TEXT PRIMARY KEY,
      department  TEXT NOT NULL,
      date        TEXT NOT NULL,
      time        TEXT NOT NULL,
      nickname    TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      tasks       TEXT NOT NULL,
      obstacles   TEXT NOT NULL DEFAULT '',
      extra_data  TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL
    )
  `)
  try {
    await db.execute(`ALTER TABLE kpi_entries ADD COLUMN extra_data TEXT NOT NULL DEFAULT ''`)
  } catch { /* column already exists */ }
  g.dbReady = true
}

export function generateId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const r = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `KPI-${ts}${r}`
}
