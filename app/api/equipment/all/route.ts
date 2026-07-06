import { NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute({
    sql: "SELECT * FROM equipment_requests WHERE status='pending' ORDER BY created_at DESC",
    args: [],
  })
  return NextResponse.json(result.rows)
}
