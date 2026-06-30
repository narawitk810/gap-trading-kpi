import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, product_name, quantity, packs_per_box, cost, note, image_data, created_at, acknowledged_at, pricing_data, old_pricing_data, status
     FROM stock_arrivals
     WHERE status IN ('pending', 'acknowledged')
     ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, COALESCE(acknowledged_at, created_at) DESC`
  )
  return NextResponse.json(result.rows)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  if (!body.id || !body.pricing) return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  await db.execute({
    sql: `UPDATE stock_arrivals SET pricing_data = ? WHERE id = ? AND status = 'acknowledged'`,
    args: [JSON.stringify(body.pricing), body.id],
  })
  return NextResponse.json({ ok: true })
}
