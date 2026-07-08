import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') === '1'

  const sql = activeOnly
    ? 'SELECT * FROM preorder_products WHERE is_active=1 ORDER BY created_at DESC'
    : 'SELECT * FROM preorder_products ORDER BY created_at DESC'

  const result = await db.execute(sql)
  const rows = result.rows.map((row: Record<string, unknown>) => {
    const raw = row.image_data as string
    if (!raw) return row
    try {
      const imgs = JSON.parse(raw)
      const first = Array.isArray(imgs) ? imgs[0] ?? '' : raw
      return { ...row, image_data: first ? JSON.stringify([first]) : '' }
    } catch { return row }
  })
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  if (!body.name?.trim() || !body.close_date?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าและวันปิดรับออเดอร์' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO preorder_products (id, name, description, price, close_date, release_date, max_qty, image_data, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      id,
      body.name.trim(),
      body.description?.trim() || '',
      Number(body.price) || 0,
      body.close_date.trim(),
      body.release_date?.trim() || '',
      Number(body.max_qty) || 0,
      body.image_data || '',
      now,
    ],
  })

  return NextResponse.json({ id }, { status: 201 })
}
