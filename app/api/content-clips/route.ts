import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute('SELECT * FROM content_clips ORDER BY created_at DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.title?.trim() || !body.drive_link?.trim() || !body.shoot_date || !body.created_by?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO content_clips (id, title, drive_link, shoot_date, created_by, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'raw', ?)`,
    args: [id, body.title.trim(), body.drive_link.trim(), body.shoot_date, body.created_by.trim(), now],
  })
  return NextResponse.json({ id }, { status: 201 })
}
