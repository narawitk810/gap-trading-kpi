import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('admin_id')
  if (adminId) {
    if (searchParams.get('key') !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const row = await db.execute({ sql: 'SELECT id, title, content, image_data, file_name, file_data, attached_file_name, is_pinned FROM announcements WHERE id = ?', args: [adminId] })
    if (!row.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row.rows[0])
  }
  const imageId = searchParams.get('image_id')
  const fileId = searchParams.get('file_id')
  if (imageId) {
    const row = await db.execute({ sql: 'SELECT image_data, file_name FROM announcements WHERE id = ?', args: [imageId] })
    const dataUri = row.rows[0]?.image_data as string
    if (!dataUri) return new Response(null, { status: 404 })
    const [header, base64] = dataUri.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(base64, 'base64')
    return new Response(buffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
  }
  if (fileId) {
    const row = await db.execute({ sql: 'SELECT file_data, attached_file_name FROM announcements WHERE id = ?', args: [fileId] })
    const dataUri = row.rows[0]?.file_data as string
    if (!dataUri) return new Response(null, { status: 404 })
    const [header, base64] = dataUri.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(base64, 'base64')
    const fileName = (row.rows[0]?.attached_file_name as string) || 'file'
    return new Response(buffer, { headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'public, max-age=86400',
    } })
  }
  const result = await db.execute(
    `SELECT id, title, content, is_pinned, is_active, created_by, created_at, file_name, attached_file_name,
            CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image,
            CASE WHEN file_data != '' AND file_data IS NOT NULL THEN 1 ELSE 0 END as has_file
     FROM announcements WHERE is_active = 1
     ORDER BY is_pinned DESC, created_at DESC`
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!String(body.title || '').trim()) {
    return NextResponse.json({ error: 'กรุณาระบุหัวข้อ' }, { status: 400 })
  }
  try {
    await ensureSchema()
    const db = getDb()
    const id = generateId()
    const now = new Date().toISOString()
    await db.execute({
      sql: `INSERT INTO announcements (id, title, content, image_data, file_name, file_data, attached_file_name, is_pinned, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [id, String(body.title || '').trim(), String(body.content || '').trim(), String(body.image_data || ''), String(body.file_name || ''), String(body.file_data || ''), String(body.attached_file_name || ''), body.is_pinned ? 1 : 0, String(body.created_by || 'HR').trim(), now, now],
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (e) {
    console.error('[announcements POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
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
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุหัวข้อ' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE announcements SET title = ?, content = ?, image_data = ?, file_name = ?, file_data = ?, attached_file_name = ?, is_pinned = ?, updated_at = ? WHERE id = ?`,
      args: [body.title.trim(), body.content.trim(), body.image_data || '', body.file_name || '', body.file_data || '', body.attached_file_name || '', body.is_pinned ? 1 : 0, now, body.id],
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
