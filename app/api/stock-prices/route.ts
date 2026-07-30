import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const db = getDb()

  // ตรวจ image_id ก่อน — ไม่ต้องรอ ensureSchema (SELECT ง่ายๆ)
  const imageId = searchParams.get('image_id')
  if (imageId) {
    const row = await db.execute({ sql: 'SELECT image_data FROM stock_arrivals WHERE id = ?', args: [imageId] })
    const dataUri = row.rows[0]?.image_data as string
    if (!dataUri) return new Response(null, { status: 404 })
    const [header, base64] = dataUri.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(base64, 'base64')
    return new Response(buffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    })
  }

  const acknowledgedOnly = searchParams.get('acknowledged_only') === 'true'
  const whereClause = acknowledgedOnly
    ? `WHERE status = 'acknowledged'`
    : `WHERE status IN ('pending', 'acknowledged')`
  const orderClause = acknowledgedOnly
    ? `ORDER BY COALESCE(acknowledged_at, created_at) DESC`
    : `ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, COALESCE(acknowledged_at, created_at) DESC`
  const result = await db.execute(
    `SELECT id, product_name, quantity, packs_per_box, cost, note,
            created_at, acknowledged_at, pricing_data, old_pricing_data,
            status, tiktok_listed_at, sku_code_box, sku_code_pack
     FROM stock_arrivals
     ${whereClause}
     ${orderClause}`
  )
  return NextResponse.json(result.rows)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  await ensureSchema()
  const db = getDb()

  if (body.action === 'sku') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await db.execute({
      sql: `UPDATE stock_arrivals SET sku_code_box = ?, sku_code_pack = ? WHERE id = ?`,
      args: [body.sku_code_box || '', body.sku_code_pack || '', body.id],
    })
    return NextResponse.json({ ok: true })
  }

  if (!body.id || !body.pricing) return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  await db.execute({
    sql: `UPDATE stock_arrivals SET pricing_data = ? WHERE id = ? AND status = 'acknowledged'`,
    args: [JSON.stringify(body.pricing), body.id],
  })
  return NextResponse.json({ ok: true })
}
