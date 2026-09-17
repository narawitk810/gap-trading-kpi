import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { notifyBlacklist } from '@/lib/line'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageId = searchParams.get('id')
  if (imageId && searchParams.get('proxy') === '1') {
    const db = getDb()
    const row = await db.execute({ sql: 'SELECT image_data FROM customer_blacklist WHERE id=?', args: [imageId] })
    const data = row.rows[0]?.image_data as string | undefined
    if (!data) return new Response(null, { status: 404 })
    if (data.startsWith('https://')) {
      const blobRes = await fetch(data)
      const buf = await blobRes.arrayBuffer()
      const ct = blobRes.headers.get('content-type') || 'image/jpeg'
      return new Response(buf, { headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' } })
    }
    const [header, base64] = data.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(base64, 'base64')
    return new Response(buffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
  }

  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, customer_name, reason, incident_date, image_data, reported_by, created_at
     FROM customer_blacklist ORDER BY incident_date DESC, created_at DESC`
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customer_name, reason, incident_date, image_data, reported_by } = body

  if (!customer_name?.trim() || !reason?.trim() || !incident_date || !reported_by?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO customer_blacklist (id, customer_name, reason, incident_date, image_data, reported_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, customer_name.trim(), reason.trim(), incident_date, image_data || null, reported_by.trim(), now],
  })

  await notifyBlacklist({
    id,
    customer_name: customer_name.trim(),
    reason: reason.trim(),
    incident_date,
    reported_by: reported_by.trim(),
    image_data: image_data || null,
  })

  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: `DELETE FROM customer_blacklist WHERE id=?`, args: [id] })
  return NextResponse.json({ ok: true })
}
