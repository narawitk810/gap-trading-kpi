import { NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, product_name, threshold_amount, start_month, end_month, note, image_data, acknowledged_at
     FROM promo_thresholds
     WHERE status = 'acknowledged'
     ORDER BY start_month DESC, acknowledged_at DESC`
  )
  return NextResponse.json(result.rows)
}
