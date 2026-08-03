import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = 'GAPtrading2024admin'
const BUILTIN_SYSTEMS = ['bandai', 'pokemon', 'liftbound']
const STORES = ['gap7card', 'catramen', 'ninjabear']

export async function GET() {
  try {
    await ensureSchema()
    const db = getDb()
    const rows = await db.execute('SELECT id, label, url, emoji FROM tournament_systems ORDER BY created_at ASC, id ASC')
    return NextResponse.json({ systems: rows.rows })
  } catch (e) {
    return NextResponse.json({ systems: [] })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { id?: string; label?: string; url?: string; emoji?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { label, url = '', emoji = '🎮' } = body
  if (!label?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อระบบ' }, { status: 400 })

  const id = (body.id?.trim() || label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
  if (!id) return NextResponse.json({ error: 'ชื่อระบบไม่ถูกต้อง' }, { status: 400 })

  try {
    await ensureSchema()
    const db = getDb()
    await db.execute({
      sql: `INSERT INTO tournament_systems (id, label, url, emoji, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [id, label.trim(), url.trim(), emoji.trim() || '🎮', new Date().toISOString()],
    })
    for (const store of STORES) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO tournament_creds (store, system, updated_at) VALUES (?, ?, '')`,
        args: [store, id],
      })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE')) return NextResponse.json({ error: `ระบบ "${id}" มีอยู่แล้ว` }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (BUILTIN_SYSTEMS.includes(id)) {
    return NextResponse.json({ error: 'ไม่สามารถลบระบบ built-in ได้' }, { status: 400 })
  }
  try {
    await ensureSchema()
    const db = getDb()
    await db.execute({ sql: 'DELETE FROM tournament_creds WHERE system = ?', args: [id] })
    await db.execute({ sql: 'DELETE FROM tournament_systems WHERE id = ?', args: [id] })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
