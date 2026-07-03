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
  const result = await db.execute('SELECT * FROM equipment_requests ORDER BY created_at DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.nickname?.trim() || !body.request_type || !body.description?.trim() || !body.image_data) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO equipment_requests (id, nickname, request_type, action, description, image_data, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      id,
      body.nickname.trim(),
      body.request_type,
      body.action?.trim() || '',
      body.description.trim(),
      body.image_data,
      now,
    ],
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
    sql: `UPDATE equipment_requests SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?`,
    args: [now, body.id],
  })
  return NextResponse.json({ ok: true })
}
