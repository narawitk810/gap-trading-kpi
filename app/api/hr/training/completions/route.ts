import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const employee_name = searchParams.get('employee_name')
  if (!employee_name) return NextResponse.json({ error: 'ไม่พบ employee_name' }, { status: 400 })
  const db = await getDb()
  const rows = await db.execute({
    sql: 'SELECT video_id FROM training_completions WHERE employee_name=?',
    args: [employee_name],
  })
  return NextResponse.json(rows.rows.map((r) => r.video_id))
}

export async function POST(req: Request) {
  const { employee_name, video_id } = await req.json()
  if (!employee_name || !video_id) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const db = await getDb()
  await db.execute({
    sql: 'INSERT OR IGNORE INTO training_completions (id, employee_name, video_id, completed_at) VALUES (?, ?, ?, ?)',
    args: [randomUUID(), employee_name, video_id, new Date().toISOString()],
  })
  return NextResponse.json({ ok: true })
}
