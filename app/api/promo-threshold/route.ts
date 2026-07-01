import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { notifyPromoAcknowledged } from '@/lib/line'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  const result = await db.execute('SELECT * FROM promo_thresholds ORDER BY created_at DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.nickname?.trim() || !body.product_name?.trim() || !body.threshold_amount?.trim() || !body.start_month?.trim() || !body.end_month?.trim() || !body.image_data) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO promo_thresholds (id, nickname, product_name, threshold_amount, start_month, end_month, note, image_data, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [id, body.nickname.trim(), body.product_name.trim(), body.threshold_amount.trim(), body.start_month.trim(), body.end_month.trim(), body.note?.trim() || null, body.image_data, now],
  })
  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM promo_thresholds WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
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

  const existing = await db.execute({
    sql: 'SELECT product_name, threshold_amount, start_month, end_month FROM promo_thresholds WHERE id = ?',
    args: [body.id],
  })

  await db.execute({
    sql: `UPDATE promo_thresholds SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?`,
    args: [now, body.id],
  })

  const row = existing.rows[0] as unknown as
    | { product_name: string; threshold_amount: string; start_month: string; end_month: string }
    | undefined
  if (row) notifyPromoAcknowledged(row)

  return NextResponse.json({ ok: true })
}
