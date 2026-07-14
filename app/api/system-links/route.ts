import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = 'GAPtrading2024admin'
const VALID_KEYS = ['store_bandai', 'store_pokemon', 'store_liftbound']

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const rows = await db.execute('SELECT key, url, label FROM system_links ORDER BY key')
  return NextResponse.json({ links: rows.rows })
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const { key, url } = body as { key: string; url: string }
  if (!VALID_KEYS.includes(key) || !url?.trim()) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  await db.execute({
    sql: 'UPDATE system_links SET url=?, updated_at=? WHERE key=?',
    args: [url.trim(), new Date().toISOString(), key],
  })
  return NextResponse.json({ ok: true })
}
