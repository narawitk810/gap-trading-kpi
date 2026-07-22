import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM equipment_requests WHERE id = ?',
    args: [params.id],
  })
  if (result.rows.length === 0) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}
