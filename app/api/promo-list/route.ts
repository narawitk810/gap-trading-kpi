import { NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, product_name, threshold_amount, start_month, end_month, note, acknowledged_at,
            CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image
     FROM promo_thresholds
     WHERE status = 'acknowledged'
     ORDER BY start_month DESC, acknowledged_at DESC`
  )
  return NextResponse.json(result.rows)
}
