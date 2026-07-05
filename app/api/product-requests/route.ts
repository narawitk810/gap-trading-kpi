import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const nickname = searchParams.get('nickname')

  await ensureSchema()
  const db = getDb()

  const isPublic = searchParams.get('public') === 'true'
  if (isPublic) {
    const result = await db.execute(
      `SELECT id, nickname, description, status, created_at, approved_at
       FROM product_requests
       ORDER BY created_at DESC
       LIMIT 100`
    )
    return NextResponse.json(result.rows)
  }

  if (key === ADMIN_KEY) {
    const result = await db.execute(
      'SELECT * FROM product_requests ORDER BY created_at DESC'
    )
    return NextResponse.json(result.rows)
  }

  if (nickname) {
    const result = await db.execute({
      sql: 'SELECT * FROM product_requests WHERE nickname = ? ORDER BY created_at DESC',
      args: [nickname],
    })
    return NextResponse.json(result.rows)
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!body.nickname?.trim() || !body.description?.trim() || !body.image_data) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()

  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO product_requests (id, nickname, description, image_data, status, created_at)
          VALUES (?, ?, ?, ?, 'pending', ?)`,
    args: [id, body.nickname.trim(), body.description.trim(), body.image_data, now],
  })

  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()

  const now = new Date().toISOString()
  await db.execute({
    sql: `UPDATE product_requests SET status = 'approved', approved_at = ? WHERE id = ?`,
    args: [now, body.id],
  })

  return NextResponse.json({ ok: true })
}
