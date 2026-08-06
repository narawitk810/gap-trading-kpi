import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const video_id = searchParams.get('video_id')
  if (!video_id) return NextResponse.json({ error: 'ไม่พบ video_id' }, { status: 400 })
  const db = await getDb()
  const rows = await db.execute({
    sql: 'SELECT employee_name, completed_at FROM training_completions WHERE video_id=? ORDER BY completed_at DESC',
    args: [video_id],
  })
  return NextResponse.json(rows.rows)
}
