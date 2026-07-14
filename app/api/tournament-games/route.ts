import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute('SELECT id, store_id, game_name FROM tournament_games ORDER BY store_id, created_at ASC')
  return NextResponse.json({ games: result.rows })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { store_id, game_name } = body as { store_id: string; game_name: string }
  if (!store_id || !game_name?.trim()) return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  try {
    await db.execute({ sql: 'INSERT INTO tournament_games (id, store_id, game_name, created_at) VALUES (?, ?, ?, ?)', args: [id, store_id, game_name.trim(), now] })
    return NextResponse.json({ game: { id, store_id, game_name: game_name.trim() } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'ชื่อเกมนี้มีอยู่แล้วในร้านนี้' }, { status: 409 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'กรุณาระบุ id' }, { status: 400 })

  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM tournament_games WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
