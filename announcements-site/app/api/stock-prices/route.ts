import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const result = await db.execute(
    `SELECT id, product_name, quantity, packs_per_box, acknowledged_at, pricing_data, tiktok_listed_at
     FROM stock_arrivals
     WHERE status = 'acknowledged'
     ORDER BY COALESCE(acknowledged_at, '') DESC`
  )
  return NextResponse.json(result.rows)
}
