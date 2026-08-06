import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const url = new URL(req.url)
  const department = url.searchParams.get('department')
  if (!department) return NextResponse.json({ error: 'ต้องระบุแผนก' }, { status: 400 })
  const rows = await db.execute({
    sql: 'SELECT id, name, badge_emoji FROM live_staff WHERE department=? ORDER BY rank_order, name',
    args: [department],
  })
  return NextResponse.json(rows.rows)
}

export async function PATCH(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const { id, badge_emoji } = await req.json()
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })
  await db.execute({
    sql: 'UPDATE live_staff SET badge_emoji=? WHERE id=?',
    args: [badge_emoji ?? '', id],
  })
  return NextResponse.json({ ok: true })
}
