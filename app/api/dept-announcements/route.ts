import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

function generateId(): string {
  return 'DA-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dept = searchParams.get('dept')
  const imageId = searchParams.get('image_id')
  const fileId = searchParams.get('file_id')

  await ensureSchema()
  const db = getDb()

  if (imageId) {
    try {
      const row = await db.execute({ sql: 'SELECT image_data FROM dept_announcements WHERE id = ?', args: [imageId] })
      const dataUri = row.rows[0]?.image_data as string
      if (!dataUri) return new Response(null, { status: 404 })
      const [header, base64] = dataUri.split(',')
      const contentType = header.replace('data:', '').replace(';base64', '')
      return new Response(Buffer.from(base64, 'base64'), { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
    } catch { return new Response(null, { status: 404 }) }
  }

  if (fileId) {
    try {
      const row = await db.execute({ sql: 'SELECT file_data, file_name FROM dept_announcements WHERE id = ?', args: [fileId] })
      const dataUri = row.rows[0]?.file_data as string
      if (!dataUri) return new Response(null, { status: 404 })
      const [header, base64] = dataUri.split(',')
      const contentType = header.replace('data:', '').replace(';base64', '')
      const fileName = (row.rows[0]?.file_name as string) || 'file'
      return new Response(Buffer.from(base64, 'base64'), { headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'public, max-age=86400',
      } })
    } catch { return new Response(null, { status: 404 }) }
  }

  try {
    if (dept) {
      const rows = await db.execute({
        sql: `SELECT id, department, title, content, created_by, created_at, image_name, file_name,
              CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image,
              CASE WHEN file_data != '' AND file_data IS NOT NULL THEN 1 ELSE 0 END as has_file
              FROM dept_announcements WHERE department=? AND is_active=1 ORDER BY created_at DESC`,
        args: [dept],
      })
      return NextResponse.json({ announcements: rows.rows })
    }
    const rows = await db.execute(
      `SELECT id, department, title, content, is_active, created_by, created_at, image_name, file_name,
              CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image,
              CASE WHEN file_data != '' AND file_data IS NOT NULL THEN 1 ELSE 0 END as has_file
       FROM dept_announcements ORDER BY department ASC, created_at DESC`
    )
    return NextResponse.json({ announcements: rows.rows })
  } catch (e) {
    console.error('[dept-announcements GET]', e)
    return NextResponse.json({ announcements: [] })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { department?: string; title?: string; content?: string; created_by?: string; image_data?: string; image_name?: string; file_data?: string; file_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { department, title, content, created_by, image_data = '', image_name = '', file_data = '', file_name = '' } = body
  if (!department?.trim()) return NextResponse.json({ error: 'กรุณาระบุแผนก' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'กรุณากรอกหัวข้อ' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: 'กรุณากรอกเนื้อหา' }, { status: 400 })
  try {
    await ensureSchema()
    const db = getDb()
    const id = generateId()
    const now = new Date().toISOString()
    await db.execute({
      sql: 'INSERT INTO dept_announcements (id, department, title, content, image_data, image_name, file_data, file_name, is_active, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?,?)',
      args: [id, department.trim(), title.trim(), content.trim(), image_data, image_name, file_data, file_name, (created_by || 'HR').trim(), now, now],
    })
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (e) {
    console.error('[dept-announcements POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { id?: string; action?: string; title?: string; content?: string; is_active?: number; image_data?: string; image_name?: string; file_data?: string; file_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { id, action } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  try {
    await ensureSchema()
    const db = getDb()
    const now = new Date().toISOString()
    if (action === 'toggle_active') {
      const row = await db.execute({ sql: 'SELECT is_active FROM dept_announcements WHERE id=?', args: [id] })
      const current = row.rows[0]?.is_active as number ?? 1
      await db.execute({ sql: 'UPDATE dept_announcements SET is_active=?, updated_at=? WHERE id=?', args: [current ? 0 : 1, now, id] })
    } else {
      const sets: string[] = []
      const args: (string | number)[] = []
      if (body.title !== undefined) { sets.push('title=?'); args.push(body.title.trim()) }
      if (body.content !== undefined) { sets.push('content=?'); args.push(body.content.trim()) }
      if (body.image_data !== undefined) { sets.push('image_data=?'); args.push(body.image_data) }
      if (body.image_name !== undefined) { sets.push('image_name=?'); args.push(body.image_name) }
      if (body.file_data !== undefined) { sets.push('file_data=?'); args.push(body.file_data) }
      if (body.file_name !== undefined) { sets.push('file_name=?'); args.push(body.file_name) }
      if (sets.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 })
      sets.push('updated_at=?')
      args.push(now, id)
      await db.execute({ sql: `UPDATE dept_announcements SET ${sets.join(', ')} WHERE id=?`, args })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[dept-announcements PATCH]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  try {
    await ensureSchema()
    const db = getDb()
    await db.execute({ sql: 'DELETE FROM dept_announcements WHERE id=?', args: [id] })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[dept-announcements DELETE]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
