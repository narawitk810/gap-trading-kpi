import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  const now = new Date().toISOString()
  await db.execute({
    sql: `UPDATE equipment_requests SET status='acknowledged', acknowledged_at=? WHERE id=?`,
    args: [now, id],
  })
  return NextResponse.json({ ok: true })
}
