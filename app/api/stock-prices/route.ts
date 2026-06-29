import { NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, product_name, quantity, packs_per_box, note, image_data, created_at, acknowledged_at, pricing_data
     FROM stock_arrivals
     WHERE status = 'acknowledged' AND pricing_data IS NOT NULL
     ORDER BY acknowledged_at DESC`
  )
  return NextResponse.json(result.rows)
}
