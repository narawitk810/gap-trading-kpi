import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

function generateId(): string {
  return 'DR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dept = searchParams.get('dept')
  try {
    await ensureSchema()
    const db = getDb()
    if (dept) {
      const rows = await db.execute({
        sql: 'SELECT id, department, title, content, sort_order FROM dept_rules WHERE department=? AND is_active=1 ORDER BY sort_order ASC, created_at ASC',
        args: [dept],
      })
      return NextResponse.json({ rules: rows.rows })
    }
    const rows = await db.execute(
      'SELECT id, department, title, content, sort_order, is_active, created_by, created_at FROM dept_rules ORDER BY department ASC, sort_order ASC, created_at ASC'
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
  let body: { department?: string; title?: string; content?: string; sort_order?: number; created_by?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { department, title, content, sort_order = 0, created_by = 'HR' } = body
  if (!department?.trim()) return NextResponse.json({ error: 'กรุณาระบุแผนก' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'กรุณากรอกหัวข้อ' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: 'กรุณากรอกเนื้อหากฎ' }, { status: 400 })
  try {
    await ensureSchema()
    const db = getDb()
    const id = generateId()
    const now = new Date().toISOString()
    await db.execute({
      sql: 'INSERT INTO dept_rules (id, department, title, content, sort_order, is_active, created_by, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?,?)',
      args: [id, department.trim(), title.trim(), content.trim(), sort_order, created_by.trim(), now, now],
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
  let body: { id?: string; title?: string; content?: string; sort_order?: number; is_active?: number }
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
