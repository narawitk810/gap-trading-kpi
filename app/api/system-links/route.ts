import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = 'GAPtrading2024admin'
const VALID_KEYS = ['store_bandai', 'store_pokemon', 'store_liftbound']

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const rows = await db.execute('SELECT key, url, label, system_id, system_password FROM system_links ORDER BY key')
  return NextResponse.json({ links: rows.rows })
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const { key, url, system_id, system_password } = body as {
    key: string
    url?: string
    system_id?: string
    system_password?: string
  }
  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  const sets: string[] = []
  const args: (string | number | null)[] = []
  if (url !== undefined) { sets.push('url=?'); args.push(url.trim()) }
  if (system_id !== undefined) { sets.push('system_id=?'); args.push(system_id.trim()) }
  if (system_password !== undefined) { sets.push('system_password=?'); args.push(system_password.trim()) }
  if (sets.length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 })
  }
  sets.push('updated_at=?')
  args.push(new Date().toISOString())
  args.push(key)
  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: `UPDATE system_links SET ${sets.join(', ')} WHERE key=?`, args })
  return NextResponse.json({ ok: true })
}
