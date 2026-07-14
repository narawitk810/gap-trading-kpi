import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = 'GAPtrading2024admin'
const VALID_STORES = ['gap7card', 'catramen', 'ninjabear']
const VALID_SYSTEMS = ['bandai', 'pokemon', 'liftbound']

export async function GET() {
  try {
    await ensureSchema()
    const db = getDb()
    const rows = await db.execute('SELECT store, system, system_id, system_password FROM tournament_creds')
    return NextResponse.json({ creds: rows.rows })
  } catch (e) {
    console.error('[tournament-creds GET]', e)
    return NextResponse.json({ creds: [] })
  }
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { store?: string; system?: string; system_id?: string; system_password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { store, system, system_id, system_password } = body
  if (!store || !VALID_STORES.includes(store)) {
    return NextResponse.json({ error: 'ร้านค้าไม่ถูกต้อง' }, { status: 400 })
  }
  if (!system || !VALID_SYSTEMS.includes(system)) {
    return NextResponse.json({ error: 'ระบบไม่ถูกต้อง' }, { status: 400 })
  }
  const sets: string[] = []
  const args: (string | null)[] = []
  if (system_id !== undefined) { sets.push('system_id=?'); args.push(system_id.trim()) }
  if (system_password !== undefined) { sets.push('system_password=?'); args.push(system_password.trim()) }
  if (sets.length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 })
  }
  sets.push('updated_at=?')
  args.push(new Date().toISOString())
  args.push(store)
  args.push(system)
  try {
    await ensureSchema()
    const db = getDb()
    await db.execute({
      sql: `UPDATE tournament_creds SET ${sets.join(', ')} WHERE store=? AND system=?`,
      args,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[tournament-creds PUT]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
