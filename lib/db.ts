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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_requests (
      id          TEXT PRIMARY KEY,
      nickname    TEXT NOT NULL,
      description TEXT NOT NULL,
      image_data  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT NOT NULL,
      approved_at TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS complaints (
      id              TEXT PRIMARY KEY,
      nickname        TEXT NOT NULL,
      department      TEXT NOT NULL,
      description     TEXT NOT NULL,
      attachment_data TEXT NOT NULL DEFAULT '',
      attachment_type TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'new',
      created_at      TEXT NOT NULL,
      reviewed_at     TEXT
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dept_codes (
      department TEXT PRIMARY KEY,
      code       TEXT NOT NULL,
      quarter    TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS restock_requests (
      id          TEXT PRIMARY KEY,
      nickname    TEXT NOT NULL,
      description TEXT NOT NULL,
      image_data  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT NOT NULL,
      noted_at    TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_arrivals (
      id               TEXT PRIMARY KEY,
      nickname         TEXT NOT NULL,
      product_name     TEXT NOT NULL,
      quantity         TEXT NOT NULL,
      packs_per_box    TEXT NOT NULL,
      cost             TEXT NOT NULL,
      note             TEXT,
      image_data       TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      created_at       TEXT NOT NULL,
      acknowledged_at  TEXT
    )
  `)

  try {
    await db.execute('ALTER TABLE stock_arrivals ADD COLUMN pricing_data TEXT')
  } catch { /* column already exists */ }

  try {
    await db.execute('ALTER TABLE stock_arrivals ADD COLUMN old_pricing_data TEXT')
  } catch { /* column already exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS promo_thresholds (
      id               TEXT PRIMARY KEY,
      nickname         TEXT NOT NULL,
      product_name     TEXT NOT NULL,
      threshold_amount TEXT NOT NULL,
      start_month      TEXT NOT NULL,
      end_month        TEXT NOT NULL,
      note             TEXT,
      image_data       TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      created_at       TEXT NOT NULL,
      acknowledged_at  TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tax_invoices (
      id           TEXT PRIMARY KEY,
      nickname     TEXT NOT NULL,
      department   TEXT NOT NULL,
      amount       REAL NOT NULL,
      invoice_date TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      image_data   TEXT NOT NULL,
      created_at   TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tcg_sessions (
      id           TEXT PRIMARY KEY,
      branch       TEXT NOT NULL DEFAULT 'gap7card',
      table_number INTEGER NOT NULL,
      match_type   TEXT NOT NULL,
      player1      TEXT NOT NULL,
      player2      TEXT,
      status       TEXT NOT NULL DEFAULT 'waiting',
      winner       TEXT,
      created_at   TEXT NOT NULL,
      started_at   TEXT,
      ended_at     TEXT
    )
  `)

  try {
    await db.execute(`ALTER TABLE tcg_sessions ADD COLUMN reported_winner TEXT`)
  } catch { /* column already exists */ }
  try {
    await db.execute(`ALTER TABLE tcg_sessions ADD COLUMN reported_by TEXT`)
  } catch { /* column already exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tcg_rankings (
      id         TEXT PRIMARY KEY,
      branch     TEXT NOT NULL DEFAULT 'gap7card',
      nickname   TEXT NOT NULL,
      wins       INTEGER NOT NULL DEFAULT 0,
      losses     INTEGER NOT NULL DEFAULT 0,
      draws      INTEGER NOT NULL DEFAULT 0,
      points     INTEGER NOT NULL DEFAULT 1000,
      updated_at TEXT NOT NULL,
      UNIQUE(branch, nickname)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS swiss_tournaments (
      id            TEXT PRIMARY KEY,
      branch        TEXT NOT NULL DEFAULT 'gap7card',
      name          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'registration',
      current_round INTEGER NOT NULL DEFAULT 0,
      total_rounds  INTEGER NOT NULL DEFAULT 0,
      host          TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      started_at    TEXT,
      ended_at      TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS swiss_players (
      id            TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      nickname      TEXT NOT NULL,
      points        INTEGER NOT NULL DEFAULT 0,
      wins          INTEGER NOT NULL DEFAULT 0,
      losses        INTEGER NOT NULL DEFAULT 0,
      draws         INTEGER NOT NULL DEFAULT 0,
      received_bye  INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL,
      UNIQUE(tournament_id, nickname)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS swiss_matches (
      id              TEXT PRIMARY KEY,
      tournament_id   TEXT NOT NULL,
      round           INTEGER NOT NULL,
      player1         TEXT NOT NULL,
      player2         TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      reported_winner TEXT,
      reported_by     TEXT,
      winner          TEXT,
      created_at      TEXT NOT NULL,
      ended_at        TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS disciplinary_evidence (
      id            TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      incident      TEXT NOT NULL,
      evidence_data TEXT NOT NULL,
      created_by    TEXT NOT NULL,
      created_dept  TEXT NOT NULL,
      created_at    TEXT NOT NULL
    )
  `)
  try { await db.execute(`ALTER TABLE disciplinary_evidence ADD COLUMN incident_date TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disciplinary_evidence ADD COLUMN time_start TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disciplinary_evidence ADD COLUMN time_end TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS equipment_requests (
      id              TEXT PRIMARY KEY,
      nickname        TEXT NOT NULL,
      request_type    TEXT NOT NULL,
      action          TEXT NOT NULL DEFAULT '',
      description     TEXT NOT NULL,
      image_data      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      created_at      TEXT NOT NULL,
      acknowledged_at TEXT
    )
  `)

  g.dbReady = true
}

export function generateId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const r = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `KPI-${ts}${r}`
}
