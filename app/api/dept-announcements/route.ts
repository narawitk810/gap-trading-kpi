import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

function generateId(): string {
  return 'DA-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dept = searchParams.get('dept')
  try {
    await ensureSchema()
    const db = getDb()
    if (dept) {
      const rows = await db.execute({
        sql: 'SELECT id, department, title, content, created_by, created_at FROM dept_announcements WHERE department=? AND is_active=1 ORDER BY created_at DESC',
        args: [dept],
      })
      return NextResponse.json({ announcements: rows.rows })
    }
    const rows = await db.execute(
      'SELECT id, department, title, content, is_active, created_by, created_at FROM dept_announcements ORDER BY department ASC, created_at DESC'
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
  let body: { department?: string; title?: string; content?: string; created_by?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { department, title, content, created_by } = body
  if (!department?.trim()) return NextResponse.json({ error: 'กรุณาระบุแผนก' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'กรุณากรอกหัวข้อ' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: 'กรุณากรอกเนื้อหา' }, { status: 400 })
  try {
    await ensureSchema()
    const db = getDb()
    const id = generateId()
    const now = new Date().toISOString()
    await db.execute({
      sql: 'INSERT INTO dept_announcements (id, department, title, content, is_active, created_by, created_at, updated_at) VALUES (?,?,?,?,1,?,?,?)',
      args: [id, department.trim(), title.trim(), content.trim(), (created_by || 'HR').trim(), now, now],
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
  let body: { id?: string; action?: string; title?: string; content?: string; is_active?: number }
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
