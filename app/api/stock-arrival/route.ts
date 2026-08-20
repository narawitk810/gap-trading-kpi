import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { notifyTiktokSeller } from '@/lib/line'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const db = getDb()

  const imageId = searchParams.get('image_id')
  if (imageId) {
    const row = await db.execute({ sql: 'SELECT image_data FROM stock_arrivals WHERE id = ?', args: [imageId] })
    const dataUri = row.rows[0]?.image_data as string
    if (!dataUri) return new Response(null, { status: 404 })
    const [header, base64] = dataUri.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    return new Response(Buffer.from(base64, 'base64'), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    })
  }

  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const result = await db.execute(
    `SELECT id, nickname, product_name, quantity, packs_per_box, cost, note,
            status, created_at, acknowledged_at, pricing_data, old_pricing_data,
            tiktok_listed_at, sku_code_box, sku_code_pack, allocation
     FROM stock_arrivals ORDER BY created_at DESC`
  )
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
  const oldPricing = body.old_pricing_data && Object.keys(body.old_pricing_data).length > 0
    ? JSON.stringify(body.old_pricing_data)
    : null
  await db.execute({
    sql: `INSERT INTO stock_arrivals (id, nickname, product_name, quantity, packs_per_box, cost, note, image_data, status, created_at, old_pricing_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    args: [id, body.nickname.trim(), body.product_name.trim(), body.quantity.trim(), body.packs_per_box.trim(), body.cost.trim(), body.note?.trim() || null, body.image_data, now, oldPricing],
  })
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_STOCK
  if (token && groupId) {
    const msg = [
      '📦 สินค้าเข้าใหม่!',
      `สินค้า: ${body.product_name.trim()}`,
      `จำนวน: ${body.quantity.trim()} ชิ้น (${body.packs_per_box.trim()} ซอง/กล่อง)`,
      `ต้นทุน: ${body.cost.trim()} บาท/กล่อง`,
      `บันทึกโดย: ${body.nickname.trim()}`,
      body.note?.trim() ? `📝 ${body.note.trim()}` : '',
      'ดูระบบ: https://gap-trading-kpi.vercel.app',
    ].filter(Boolean).join('\n')
    fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: msg }] }),
    }).catch(() => {})
  }

  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const isAdmin = searchParams.get('key') === ADMIN_KEY
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  if (isAdmin) {
    await db.execute({ sql: 'DELETE FROM stock_arrivals WHERE id = ?', args: [body.id] })
  } else {
    const result = await db.execute({
      sql: "DELETE FROM stock_arrivals WHERE id = ? AND status = 'pending'",
      args: [body.id],
    })
    if ((result.rowsAffected ?? 0) === 0)
      return NextResponse.json({ error: 'ไม่สามารถลบได้ เนื่องจาก Admin ดำเนินการแล้ว' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const isAdmin = searchParams.get('key') === ADMIN_KEY
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()

  if (body.action === 'mark_tiktok') {
    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE stock_arrivals SET tiktok_listed_at = ? WHERE id = ? AND status = 'acknowledged'`,
      args: [now, body.id],
    })
    db.execute({
      sql: `SELECT id, product_name, quantity, packs_per_box, pricing_data, allocation, sku_code_box, sku_code_pack,
                   CASE WHEN image_data IS NOT NULL AND image_data != '' THEN 1 ELSE 0 END AS has_image
            FROM stock_arrivals WHERE id = ?`,
      args: [body.id],
    }).then((row) => {
      const r = row.rows[0]
      if (r) notifyTiktokSeller({
        id: r.id as string,
        product_name: r.product_name as string,
        quantity: r.quantity as string,
        packs_per_box: r.packs_per_box as string,
        pricing_data: r.pricing_data as string | null,
        allocation: r.allocation as string | null,
        sku_code_box: r.sku_code_box as string | null,
        sku_code_pack: r.sku_code_pack as string | null,
        has_image: r.has_image === 1,
      })
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'unmark_tiktok') {
    await db.execute({
      sql: `UPDATE stock_arrivals SET tiktok_listed_at = '' WHERE id = ? AND status = 'acknowledged'`,
      args: [body.id],
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update_allocation') {
    await db.execute({ sql: 'UPDATE stock_arrivals SET allocation = ? WHERE id = ?', args: [body.allocation ?? '', body.id] })
    return NextResponse.json({ ok: true })
  }

  if (isAdmin) {
    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE stock_arrivals SET status = 'acknowledged', acknowledged_at = ?, pricing_data = ? WHERE id = ?`,
      args: [now, body.pricing ? JSON.stringify(body.pricing) : null, body.id],
    })
    return NextResponse.json({ ok: true })
  }

  const { product_name, quantity, packs_per_box, cost, note, old_pricing_data } = body
  if (!product_name?.trim() || !quantity?.trim() || !packs_per_box?.trim() || !cost?.trim()) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const oldPricingStr = old_pricing_data && Object.keys(old_pricing_data).length > 0
    ? JSON.stringify(old_pricing_data) : null
  const result = await db.execute({
    sql: `UPDATE stock_arrivals SET product_name=?, quantity=?, packs_per_box=?, cost=?, note=?, old_pricing_data=? WHERE id=? AND status='pending'`,
    args: [product_name.trim(), quantity.trim(), packs_per_box.trim(), cost.trim(), note?.trim() || null, oldPricingStr, body.id],
  })
  if ((result.rowsAffected ?? 0) === 0)
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขได้ — Admin ดำเนินการแล้ว' }, { status: 403 })
  return NextResponse.json({ ok: true })
}
