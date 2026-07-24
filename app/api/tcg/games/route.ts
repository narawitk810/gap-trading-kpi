import { NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, name, short_name, sort_order FROM tcg_games WHERE is_active = 1 ORDER BY sort_order ASC`
  )
  return NextResponse.json(result.rows)
}
