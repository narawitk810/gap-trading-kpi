import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const url = new URL(req.url)
  const department = url.searchParams.get('department')
  const result = department
    ? await db.execute({ sql: 'SELECT * FROM live_staff WHERE department = ? ORDER BY rank_order, name', args: [department] })
    : await db.execute('SELECT * FROM live_staff ORDER BY department, rank_order, name')
  return NextResponse.json({ staff: result.rows })
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { name, rank_name, rank_emoji, rank_order, department = 'ไลฟ์สด' } = body
  if (!name?.trim() || !rank_name || !rank_emoji || rank_order === undefined) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const prefix = department === 'Creative' ? 'cs' : 'ls'
  const id = `${prefix}-${Date.now()}`
  const now = new Date().toISOString()
  try {
    await db.execute({
      sql: 'INSERT INTO live_staff (id, name, rank_name, rank_emoji, rank_order, department, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, name.trim(), rank_name, rank_emoji, Number(rank_order), department, now],
    })
  } catch {
    return NextResponse.json({ error: 'ชื่อนี้มีอยู่แล้ว' }, { status: 409 })
  }
  return NextResponse.json({ ok: true, staff: { id, name: name.trim(), rank_name, rank_emoji, rank_order: Number(rank_order), department, created_at: now } })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM live_staff WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { id, rank_name, rank_emoji, rank_order, is_head } = body
  if (!id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  if (is_head !== undefined && rank_name === undefined) {
    await db.execute({ sql: 'UPDATE live_staff SET is_head=? WHERE id=?', args: [is_head ? 1 : 0, id] })
    return NextResponse.json({ ok: true })
  }
  if (!rank_name || !rank_emoji || rank_order === undefined) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  await db.execute({
    sql: 'UPDATE live_staff SET rank_name=?, rank_emoji=?, rank_order=? WHERE id=?',
    args: [rank_name, rank_emoji, Number(rank_order), id],
  })
  return NextResponse.json({ ok: true })
}
