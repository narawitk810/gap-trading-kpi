import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute('SELECT * FROM live_staff ORDER BY rank_order, name')
  return NextResponse.json({ staff: result.rows })
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { id, rank_name, rank_emoji, rank_order } = body
  if (!id || !rank_name || !rank_emoji || rank_order === undefined) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  await db.execute({
    sql: 'UPDATE live_staff SET rank_name=?, rank_emoji=?, rank_order=? WHERE id=?',
    args: [rank_name, rank_emoji, Number(rank_order), id],
  })
  return NextResponse.json({ ok: true })
}
