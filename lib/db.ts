import { createClient, type Client } from '@libsql/client'
import path from 'path'
import fs from 'fs'

const SCHEMA_VERSION = 34
const g = globalThis as unknown as { db: Client | undefined; dbVersion: number }

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
    g.dbVersion = 0
  }
  return g.db
}

export async function ensureSchema(): Promise<void> {
  if (g.dbVersion >= SCHEMA_VERSION) return
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
  try {
    await db.execute(`ALTER TABLE product_requests ADD COLUMN rejected_reason TEXT`)
  } catch { /* column already exists */ }

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

  try {
    await db.execute('ALTER TABLE stock_arrivals ADD COLUMN tiktok_listed_at TEXT DEFAULT ""')
  } catch { /* column already exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS announcements (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      image_data  TEXT DEFAULT '',
      is_pinned   INTEGER DEFAULT 0,
      is_active   INTEGER DEFAULT 1,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `)

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
    CREATE TABLE IF NOT EXISTS meeting_reports (
      id             TEXT PRIMARY KEY,
      nickname       TEXT NOT NULL,
      meeting_date   TEXT NOT NULL,
      meeting_time   TEXT NOT NULL,
      participants   TEXT NOT NULL,
      summary        TEXT NOT NULL,
      decisions      TEXT NOT NULL,
      action_items   TEXT NOT NULL,
      pending_issues TEXT NOT NULL DEFAULT '',
      next_meeting   TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL
    )
  `)

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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS break_bookings (
      id         TEXT PRIMARY KEY,
      nickname   TEXT NOT NULL,
      date       TEXT NOT NULL,
      hour_slot  INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS vip_customers (
      id          TEXT PRIMARY KEY,
      firstname   TEXT NOT NULL,
      lastname    TEXT NOT NULL,
      nickname    TEXT NOT NULL DEFAULT '',
      gender      TEXT NOT NULL DEFAULT '',
      tier        TEXT NOT NULL,
      day         INTEGER NOT NULL,
      month       INTEGER NOT NULL,
      year        TEXT NOT NULL DEFAULT '',
      phone       TEXT NOT NULL,
      email       TEXT NOT NULL DEFAULT '',
      line        TEXT NOT NULL DEFAULT '',
      tiktok      TEXT NOT NULL DEFAULT '',
      manager     TEXT NOT NULL DEFAULT '',
      address     TEXT NOT NULL DEFAULT '',
      note        TEXT NOT NULL DEFAULT '',
      gifts       TEXT NOT NULL DEFAULT '[]',
      notify      TEXT NOT NULL DEFAULT '[7]',
      gift_status TEXT NOT NULL DEFAULT 'none',
      purchases   TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_staff (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      rank_name  TEXT NOT NULL,
      rank_emoji TEXT NOT NULL,
      rank_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)
  try {
    await db.execute(`ALTER TABLE live_staff ADD COLUMN department TEXT NOT NULL DEFAULT 'ไลฟ์สด'`)
  } catch { /* column already exists */ }
  try {
    await db.execute(`ALTER TABLE live_staff ADD COLUMN is_head INTEGER NOT NULL DEFAULT 0`)
  } catch { /* column already exists */ }

  {
    const now = new Date().toISOString()
    const seed: [string, string, string, string, number, string][] = [
      ['ls-001', 'เอิร์น', 'Junior Live Sales', '🥉', 1, 'ไลฟ์สด'],
      ['ls-002', 'ต้น', 'Junior Live Sales', '🥉', 1, 'ไลฟ์สด'],
      ['ls-003', 'อาลีฟ', 'Junior Live Sales', '🥉', 1, 'ไลฟ์สด'],
      ['ls-004', 'มัส', 'Junior Live Sales', '🥉', 1, 'ไลฟ์สด'],
      ['ls-005', 'เดียร์', 'Junior Live Sales', '🥉', 1, 'ไลฟ์สด'],
      ['ls-006', 'กันต์', 'Live Sales', '🥈', 2, 'ไลฟ์สด'],
      ['ls-007', 'คิง', 'Live Sales', '🥈', 2, 'ไลฟ์สด'],
      ['ls-008', 'จ๊าบ', 'Live Sales', '🥈', 2, 'ไลฟ์สด'],
      ['ls-009', 'แบม', 'Live Sales', '🥈', 2, 'ไลฟ์สด'],
      ['ls-010', 'เฉิน', 'Live Sales', '🥈', 2, 'ไลฟ์สด'],
      ['ls-011', 'ขวัญ', 'Senior Live Sales', '🥇', 3, 'ไลฟ์สด'],
      ['ls-012', 'จ๊ะ', 'Senior Live Sales', '🥇', 3, 'ไลฟ์สด'],
      ['ls-013', 'เลย์', 'Senior Live Sales', '🥇', 3, 'ไลฟ์สด'],
      ['ls-014', 'ไข่เจีย', 'Senior Live Sales', '🥇', 3, 'ไลฟ์สด'],
      ['ls-015', 'มายด์', 'Senior Live Sales', '🥇', 3, 'ไลฟ์สด'],
      ['ls-016', 'เก็ท', 'Senior Live Sales', '🥇', 3, 'ไลฟ์สด'],
      ['ls-017', 'นีล', 'Expert Live Sales', '🏅', 4, 'ไลฟ์สด'],
      ['ls-018', 'หนิง', 'Expert Live Sales', '🏅', 4, 'ไลฟ์สด'],
      ['ls-019', 'บิว', 'Expert Live Sales', '🏅', 4, 'ไลฟ์สด'],
      ['cs-001', 'เฟรม', 'Junior Creative', '🥉', 1, 'Creative'],
      ['cs-002', 'ไทด์', 'Creative', '🥈', 2, 'Creative'],
      ['cs-003', 'แก๊ง', 'Senior Creative', '🥇', 3, 'Creative'],
      ['mkt-001', 'เกอร์', 'Junior Marketing', '🥉', 1, 'การตลาด'],
      ['sa-001', 'พลอย', 'Sales Admin', '🥈', 2, 'Sales Admin'],
      ['stk-001', 'เดียร์ (สต๊อค)', 'Senior Stock & Purchasing', '🥇', 3, 'สต๊อค&จัดซื้อ'],
      ['stk-002', 'เตย', 'Senior Stock & Purchasing', '🥇', 3, 'สต๊อค&จัดซื้อ'],
      ['pack-001', 'เฟิร์น', 'Fulfillment', '🥈', 2, 'แพค'],
      ['acc-001', 'นิว', 'Accounting Supervisor', '📋', 2, 'บัญชี&การเงิน'],
      ['adm-001', 'จ๋า', 'Administration Officer', '🗂️', 1, 'ธุรการ'],
      ['hr-001', 'ปิ่น', 'HR Supervisor', '🧑‍💼', 2, 'บุคคล'],
      ['lm-001', 'ธีร์', 'Live Team Leader', '👥', 1, 'ผู้จัดการไลฟ์สด'],
    ]
    for (const [id, name, rank_name, rank_emoji, rank_order, department] of seed) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO live_staff (id, name, rank_name, rank_emoji, rank_order, department, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, name, rank_name, rank_emoji, rank_order, department, now],
      })
    }
    for (const headName of ['บิว', 'นีล', 'แก๊ง']) {
      await db.execute({ sql: 'UPDATE live_staff SET is_head=1 WHERE name=?', args: [headName] })
    }
  }

  await db.execute(`UPDATE live_staff SET department='Sales Admin' WHERE department='sale admin'`)
  await db.execute(`UPDATE kpi_entries SET department='Sales Admin' WHERE department='sale admin'`)
  await db.execute(`UPDATE live_staff SET name='เดียร์ (สต๊อค)' WHERE id='stk-001' AND name='เดียร์'`)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS disbursements (
      id                    TEXT PRIMARY KEY,
      requester             TEXT NOT NULL,
      item_list             TEXT NOT NULL,
      requested_amount      REAL NOT NULL,
      request_doc           TEXT NOT NULL DEFAULT '',
      request_date          TEXT NOT NULL,
      approved_by           TEXT NOT NULL DEFAULT '',
      transfer_amount       REAL,
      payment_slip          TEXT NOT NULL DEFAULT '',
      approved_at           TEXT NOT NULL DEFAULT '',
      ordered_by            TEXT NOT NULL DEFAULT '',
      actual_amount         REAL,
      order_note            TEXT NOT NULL DEFAULT '',
      ordered_at            TEXT NOT NULL DEFAULT '',
      payment_note          TEXT NOT NULL DEFAULT '',
      remaining_note        TEXT NOT NULL DEFAULT '',
      payment_recorded_at   TEXT NOT NULL DEFAULT '',
      close_month           TEXT NOT NULL DEFAULT '',
      closed_by             TEXT NOT NULL DEFAULT '',
      closed_at             TEXT NOT NULL DEFAULT '',
      status                TEXT NOT NULL DEFAULT 'pending_approval',
      equipment_id          TEXT NOT NULL DEFAULT '',
      created_at            TEXT NOT NULL
    )
  `)

  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN request_doc TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN equipment_id TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN order_disburse_slip TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN order_pay_slip TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN advance_slip TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN reimbursed_at TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN reimbursement_slip TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN order_channel TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN order_channel_image TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN qr_slip TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN tax_invoice_status TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN tax_invoice_image TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN tax_invoice_no_reason TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN bank_account TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN bank_name TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE disbursements ADD COLUMN tax_invoice_pdf TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS preorder_products (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      price        REAL NOT NULL DEFAULT 0,
      close_date   TEXT NOT NULL,
      release_date TEXT NOT NULL DEFAULT '',
      sku          TEXT NOT NULL DEFAULT '',
      max_qty      INTEGER NOT NULL DEFAULT 0,
      image_data   TEXT NOT NULL DEFAULT '',
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL
    )
  `)
  try { await db.execute(`ALTER TABLE preorder_products ADD COLUMN release_date TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE preorder_products ADD COLUMN sku TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS preorder_orders (
      id         TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      nickname   TEXT NOT NULL,
      quantity   INTEGER NOT NULL DEFAULT 1,
      phone      TEXT NOT NULL DEFAULT '',
      note       TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_links (
      key        TEXT PRIMARY KEY,
      url        TEXT NOT NULL,
      label      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.execute(`INSERT OR IGNORE INTO system_links (key, url, label, updated_at) VALUES ('store_bandai', 'https://distributor.bandai-tcg-plus.com/#/event_series_detail/home', 'Bandai TCG+', '')`)
  await db.execute(`INSERT OR IGNORE INTO system_links (key, url, label, updated_at) VALUES ('store_pokemon', 'https://event.asia.pokemon-card.com/login/th', 'Pokemon', '')`)
  await db.execute(`INSERT OR IGNORE INTO system_links (key, url, label, updated_at) VALUES ('store_liftbound', 'https://www.carde.io/', 'Liftbound & Lorcana', '')`)
  try { await db.execute(`ALTER TABLE system_links ADD COLUMN system_id TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE system_links ADD COLUMN system_password TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }

  const STORE_CRED_ROWS: [string, string, string][] = [
    ['gap7card_bandai',     'https://distributor.bandai-tcg-plus.com/#/event_series_detail/home', 'gap7card – Bandai TCG+'],
    ['gap7card_pokemon',    'https://event.asia.pokemon-card.com/login/th',                       'gap7card – Pokemon'],
    ['gap7card_liftbound',  'https://www.carde.io/',                                              'gap7card – Liftbound & Lorcana'],
    ['catramen_bandai',     'https://distributor.bandai-tcg-plus.com/#/event_series_detail/home', 'catramen – Bandai TCG+'],
    ['catramen_pokemon',    'https://event.asia.pokemon-card.com/login/th',                       'catramen – Pokemon'],
    ['catramen_liftbound',  'https://www.carde.io/',                                              'catramen – Liftbound & Lorcana'],
    ['ninjabear_bandai',    'https://distributor.bandai-tcg-plus.com/#/event_series_detail/home', 'ninjabear – Bandai TCG+'],
    ['ninjabear_pokemon',   'https://event.asia.pokemon-card.com/login/th',                       'ninjabear – Pokemon'],
    ['ninjabear_liftbound', 'https://www.carde.io/',                                              'ninjabear – Liftbound & Lorcana'],
  ]
  for (const [key, url, label] of STORE_CRED_ROWS) {
    await db.execute(`INSERT OR IGNORE INTO system_links (key, url, label, updated_at) VALUES ('${key}', '${url}', '${label}', '')`)
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournament_creds (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      store        TEXT NOT NULL,
      system       TEXT NOT NULL,
      system_id    TEXT NOT NULL DEFAULT '',
      system_password TEXT NOT NULL DEFAULT '',
      updated_at   TEXT NOT NULL DEFAULT '',
      UNIQUE(store, system)
    )
  `)
  for (const store of ['gap7card', 'catramen', 'ninjabear']) {
    for (const system of ['bandai', 'pokemon', 'liftbound']) {
      await db.execute(`INSERT OR IGNORE INTO tournament_creds (store, system, updated_at) VALUES ('${store}', '${system}', '')`)
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournament_events (
      id           TEXT PRIMARY KEY,
      kpi_id       TEXT NOT NULL,
      store_id     TEXT NOT NULL,
      nickname     TEXT NOT NULL,
      facebook_url TEXT NOT NULL DEFAULT '',
      event_date   TEXT NOT NULL,
      start_time   TEXT NOT NULL DEFAULT '',
      created_at   TEXT NOT NULL
    )
  `)
  await db.execute(`ALTER TABLE tournament_events ADD COLUMN activity_name TEXT NOT NULL DEFAULT ''`).catch(() => {})

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tcg_games (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      short_name TEXT NOT NULL,
      is_active  INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  {
    const now = new Date().toISOString()
    const games: [string, string, string, number][] = [
      ['onepiece',   'One Piece Card Game', 'ONE PIECE', 1],
      ['gundam',     'Gundam Card Game',    'GUNDAM',    2],
      ['vanguard',   'Vanguard D TH',       'VANGUARD',  3],
      ['talingchan', 'Battle of Talingchan','TALINGCHAN', 4],
    ]
    for (const [id, name, short_name, sort_order] of games) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO tcg_games (id, name, short_name, is_active, sort_order, created_at) VALUES (?,?,?,1,?,?)',
        args: [id, name, short_name, sort_order, now],
      })
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tcg_game_rewards (
      id          TEXT PRIMARY KEY,
      game_id     TEXT NOT NULL,
      month       TEXT NOT NULL,
      tier        TEXT NOT NULL,
      reward_text TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL,
      UNIQUE(game_id, month, tier)
    )
  `)

  try { await db.execute(`ALTER TABLE tcg_sessions ADD COLUMN game TEXT NOT NULL DEFAULT 'general'`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE tcg_rankings ADD COLUMN game TEXT NOT NULL DEFAULT 'general'`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE tcg_game_rewards ADD COLUMN image_url TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE tcg_members ADD COLUMN date_of_birth TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE stock_arrivals ADD COLUMN sku_code TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE stock_arrivals RENAME COLUMN sku_code TO sku_code_box`) } catch { /* already renamed */ }
  try { await db.execute(`ALTER TABLE stock_arrivals ADD COLUMN sku_code_pack TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tcg_members (
      id         TEXT PRIMARY KEY,
      branch     TEXT NOT NULL DEFAULT 'gap7card',
      full_name  TEXT NOT NULL,
      phone      TEXT NOT NULL,
      nickname   TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(branch, nickname),
      UNIQUE(branch, phone)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournament_games (
      id         TEXT PRIMARY KEY,
      store_id   TEXT NOT NULL,
      game_name  TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(store_id, game_name)
    )
  `)

  // Indexes for frequent query patterns — added SCHEMA_VERSION 33
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_status ON stock_arrivals(status)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_created ON stock_arrivals(created_at)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_promo_status ON promo_list(status)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, is_pinned)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_kpi_dept ON kpi_submissions(department, created_at)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tcg_branch ON tcg_game_sessions(branch, status)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_disbursements_dept ON disbursements(department, created_at)`)

  g.dbVersion = SCHEMA_VERSION
}

export function generateId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const r = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `KPI-${ts}${r}`
}
