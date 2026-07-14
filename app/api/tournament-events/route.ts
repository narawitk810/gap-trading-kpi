import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || ''
  const to   = searchParams.get('to')   || ''

  await ensureSchema()
  const db = getDb()

  let sql = 'SELECT * FROM tournament_events WHERE 1=1'
  const args: string[] = []
  if (from) { sql += ' AND event_date >= ?'; args.push(from) }
  if (to)   { sql += ' AND event_date <= ?'; args.push(to) }
  sql += ' ORDER BY event_date DESC, start_time ASC'

  const result = await db.execute({ sql, args })
  return NextResponse.json({ events: result.rows })
}
