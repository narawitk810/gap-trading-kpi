import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const result = await db.execute(
    `SELECT * FROM announcements WHERE is_active = 1
     ORDER BY is_pinned DESC, created_at DESC`
  )
  return NextResponse.json(result.rows)
}
