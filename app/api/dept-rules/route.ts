import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

function generateId(): string {
  return 'DR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('admin_id')
  const dept = searchParams.get('dept')
  const imageId = searchParams.get('image_id')
  const fileId = searchParams.get('file_id')

  await ensureSchema()
  const db = getDb()

  if (adminId) {
    if (searchParams.get('key') !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const row = await db.execute({ sql: 'SELECT id, department, title, content, sort_order, image_data, image_name, file_data, file_name, created_by FROM dept_rules WHERE id = ?', args: [adminId] })
    if (!row.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row.rows[0])
  }

  if (imageId) {
    try {
      const row = await db.execute({ sql: 'SELECT image_data FROM dept_rules WHERE id = ?', args: [imageId] })
      const dataUri = row.rows[0]?.image_data as string
      if (!dataUri) return new Response(null, { status: 404 })
      const [header, base64] = dataUri.split(',')
      const contentType = header.replace('data:', '').replace(';base64', '')
      return new Response(Buffer.from(base64, 'base64'), { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
    } catch { return new Response(null, { status: 404 }) }
  }

  if (fileId) {
    try {
      const row = await db.execute({ sql: 'SELECT file_data, file_name FROM dept_rules WHERE id = ?', args: [fileId] })
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
        sql: `SELECT id, department, title, content, sort_order, image_name, file_name,
              CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image,
              CASE WHEN file_data != '' AND file_data IS NOT NULL THEN 1 ELSE 0 END as has_file
              FROM dept_rules WHERE department=? AND is_active=1 ORDER BY sort_order ASC, created_at ASC`,
        args: [dept],
      })
      return NextResponse.json({ rules: rows.rows })
    }
    const rows = await db.execute(
      `SELECT id, department, title, content, sort_order, is_active, created_by, created_at, image_name, file_name,
              CASE WHEN image_data != '' AND image_data IS NOT NULL THEN 1 ELSE 0 END as has_image,
              CASE WHEN file_data != '' AND file_data IS NOT NULL THEN 1 ELSE 0 END as has_file
       FROM dept_rules ORDER BY department ASC, sort_order ASC, created_at ASC`
    )
    return NextResponse.json({ rules: rows.rows })
  } catch (e) {
    console.error('[dept-rules GET]', e)
    return NextResponse.json({ rules: [] })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { department?: string; title?: string; content?: string; sort_order?: number; created_by?: string; image_data?: string; image_name?: string; file_data?: string; file_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { department, title, content, sort_order = 0, created_by = 'HR', image_data = '', image_name = '', file_data = '', file_name = '' } = body
  if (!department?.trim()) return NextResponse.json({ error: 'กรุณาระบุแผนก' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'กรุณากรอกหัวข้อ' }, { status: 400 })
  try {
    await ensureSchema()
    const db = getDb()
    const id = generateId()
    const now = new Date().toISOString()
    await db.execute({
      sql: 'INSERT INTO dept_rules (id, department, title, content, sort_order, image_data, image_name, file_data, file_name, is_active, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)',
      args: [id, department.trim(), title.trim(), (content || '').trim(), sort_order, image_data, image_name, file_data, file_name, created_by.trim(), now, now],
    })
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (e) {
    console.error('[dept-rules POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { id?: string; title?: string; content?: string; sort_order?: number; is_active?: number; image_data?: string; image_name?: string; file_data?: string; file_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const sets: string[] = []
  const args: (string | number)[] = []
  if (body.title !== undefined) { sets.push('title=?'); args.push(body.title.trim()) }
  if (body.content !== undefined) { sets.push('content=?'); args.push(body.content.trim()) }
  if (body.sort_order !== undefined) { sets.push('sort_order=?'); args.push(body.sort_order) }
  if (body.is_active !== undefined) { sets.push('is_active=?'); args.push(body.is_active) }
  if (body.image_data !== undefined) { sets.push('image_data=?'); args.push(body.image_data) }
  if (body.image_name !== undefined) { sets.push('image_name=?'); args.push(body.image_name) }
  if (body.file_data !== undefined) { sets.push('file_data=?'); args.push(body.file_data) }
  if (body.file_name !== undefined) { sets.push('file_name=?'); args.push(body.file_name) }
  if (sets.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 })
  sets.push('updated_at=?')
  args.push(new Date().toISOString(), id)
  try {
    await ensureSchema()
    const db = getDb()
    await db.execute({ sql: `UPDATE dept_rules SET ${sets.join(', ')} WHERE id=?`, args })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[dept-rules PATCH]', e)
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
    await db.execute({ sql: 'DELETE FROM dept_rules WHERE id=?', args: [id] })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[dept-rules DELETE]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
