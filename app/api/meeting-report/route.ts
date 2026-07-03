import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    'SELECT * FROM meeting_reports ORDER BY created_at DESC'
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (
    !body.nickname?.trim() ||
    !body.meeting_date?.trim() ||
    !body.meeting_time?.trim() ||
    !body.participants?.trim() ||
    !body.summary?.trim() ||
    !body.decisions?.trim() ||
    !body.action_items?.trim()
  ) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO meeting_reports
          (id, nickname, meeting_date, meeting_time, participants, summary, decisions, action_items, pending_issues, next_meeting, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      body.nickname.trim(),
      body.meeting_date.trim(),
      body.meeting_time.trim(),
      body.participants.trim(),
      body.summary.trim(),
      body.decisions.trim(),
      body.action_items.trim(),
      body.pending_issues?.trim() || '',
      body.next_meeting?.trim() || '',
      now,
    ],
  })
  return NextResponse.json({ id }, { status: 201 })
}
