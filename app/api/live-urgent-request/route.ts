import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { notifyLiveUrgentRequest } from '@/lib/line'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageId = searchParams.get('image_id')
  if (imageId && searchParams.get('proxy') === '1') {
    const db = getDb()
    const row = await db.execute({ sql: 'SELECT image_data FROM live_urgent_requests WHERE id=?', args: [imageId] })
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
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { nickname, product_name, quantity, note, image_data } = body

  if (!nickname?.trim() || !product_name?.trim() || !quantity?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO live_urgent_requests (id, nickname, product_name, quantity, note, image_data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, nickname.trim(), product_name.trim(), quantity.trim(), note?.trim() || '', image_data || null, now],
  })

  await notifyLiveUrgentRequest({
    id,
    nickname: nickname.trim(),
    product_name: product_name.trim(),
    quantity: quantity.trim(),
    note: note?.trim() || '',
    image_data: image_data || null,
  })

  return NextResponse.json({ id }, { status: 201 })
}
