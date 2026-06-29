import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch') || 'gap7card'
  await ensureSchema()
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT * FROM swiss_tournaments WHERE branch = ? AND status != 'completed' ORDER BY created_at DESC`,
    args: [branch],
  })
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { branch = 'gap7card', name, host } = body
  if (!name?.trim() || !host?.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุชื่อทัวร์นาเมนต์และชื่อ Host' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO swiss_tournaments (id, branch, name, status, current_round, total_rounds, host, created_at) VALUES (?, ?, ?, 'registration', 0, 0, ?, ?)`,
    args: [id, branch, name.trim(), host.trim(), now],
  })
  return NextResponse.json({ id }, { status: 201 })
}
