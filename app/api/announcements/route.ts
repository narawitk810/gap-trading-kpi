import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const imageId = searchParams.get('image_id')
  if (imageId) {
    const row = await db.execute({ sql: 'SELECT image_data FROM announcements WHERE id = ?', args: [imageId] })
    const dataUri = row.rows[0]?.image_data as string
    if (!dataUri) return new Response(null, { status: 404 })
    const [header, base64] = dataUri.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(base64, 'base64')
    return new Response(buffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    })
  }
  const result = await db.execute(
    `SELECT id, title, content, is_pinned, is_active, created_by, created_at,
            CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image
     FROM announcements WHERE is_active = 1
     ORDER BY is_pinned DESC, created_at DESC`
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!body.title?.trim() || !body.content?.trim() || !body.created_by?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO announcements (id, title, content, image_data, is_pinned, is_active, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    args: [id, body.title.trim(), body.content.trim(), body.image_data || '', body.is_pinned ? 1 : 0, body.created_by.trim(), now, now],
  })
  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  const now = new Date().toISOString()

  if (body.action === 'toggle_active') {
    await db.execute({
      sql: `UPDATE announcements SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`,
      args: [now, body.id],
    })
  } else {
    if (!body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE announcements SET title = ?, content = ?, image_data = ?, is_pinned = ?, updated_at = ? WHERE id = ?`,
      args: [body.title.trim(), body.content.trim(), body.image_data || '', body.is_pinned ? 1 : 0, now, body.id],
    })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const body = await request.json()
  if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM announcements WHERE id = ?', args: [body.id] })
  return NextResponse.json({ ok: true })
}
