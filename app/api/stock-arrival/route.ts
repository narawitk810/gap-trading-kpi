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
  const result = await db.execute('SELECT * FROM stock_arrivals ORDER BY created_at DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.nickname?.trim() || !body.product_name?.trim() || !body.quantity?.trim() || !body.packs_per_box?.trim() || !body.cost?.trim() || !body.image_data) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO stock_arrivals (id, nickname, product_name, quantity, packs_per_box, cost, note, image_data, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [id, body.nickname.trim(), body.product_name.trim(), body.quantity.trim(), body.packs_per_box.trim(), body.cost.trim(), body.note?.trim() || null, body.image_data, now],
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
    sql: `UPDATE stock_arrivals SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?`,
    args: [now, body.id],
  })
  return NextResponse.json({ ok: true })
}
