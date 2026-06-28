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
  const result = await db.execute('SELECT * FROM complaints ORDER BY created_at DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.nickname?.trim() || !body.department || !body.description?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO complaints (id, nickname, department, description, attachment_data, attachment_type, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`,
    args: [id, body.nickname.trim(), body.department, body.description.trim(),
           body.attachment_data || '', body.attachment_type || '', now],
  })
  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  const now = new Date().toISOString()
  await db.execute({
    sql: `UPDATE complaints SET status = 'reviewed', reviewed_at = ? WHERE id = ?`,
    args: [now, body.id],
  })
  return NextResponse.json({ ok: true })
}
