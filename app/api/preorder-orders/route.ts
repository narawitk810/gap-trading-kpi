import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchema()
  const db = getDb()
  const productId = searchParams.get('product_id')

  const result = productId
    ? await db.execute({
        sql: 'SELECT * FROM preorder_orders WHERE product_id=? ORDER BY created_at DESC',
        args: [productId],
      })
    : await db.execute('SELECT * FROM preorder_orders ORDER BY created_at DESC')

  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!body.product_id?.trim() || !body.nickname?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  if (!body.quantity || Number(body.quantity) < 1) {
    return NextResponse.json({ error: 'กรุณาระบุจำนวนอย่างน้อย 1' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()

  // Check product still active and not past close_date
  const productResult = await db.execute({
    sql: 'SELECT * FROM preorder_products WHERE id=? AND is_active=1',
    args: [body.product_id.trim()],
  })
  if (productResult.rows.length === 0) {
    return NextResponse.json({ error: 'สินค้านี้ไม่พร้อมรับออเดอร์แล้ว' }, { status: 400 })
  }

  const product = productResult.rows[0]
  const today = new Date().toISOString().slice(0, 10)
  if (String(product.close_date) < today) {
    return NextResponse.json({ error: 'หมดเวลารับออเดอร์สินค้านี้แล้ว' }, { status: 400 })
  }

  // Check max_qty
  const maxQty = Number(product.max_qty)
  if (maxQty > 0) {
    const sumResult = await db.execute({
      sql: "SELECT COALESCE(SUM(quantity),0) as total FROM preorder_orders WHERE product_id=? AND status != 'cancelled'",
      args: [body.product_id.trim()],
    })
    const currentTotal = Number(sumResult.rows[0]?.total || 0)
    if (currentTotal + Number(body.quantity) > maxQty) {
      return NextResponse.json({ error: `เหลือรับได้อีก ${maxQty - currentTotal} ชิ้นเท่านั้น` }, { status: 400 })
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO preorder_orders (id, product_id, nickname, quantity, phone, note, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      id,
      body.product_id.trim(),
      body.nickname.trim(),
      Number(body.quantity),
      body.phone?.trim() || '',
      body.note?.trim() || '',
      now,
    ],
  })

  return NextResponse.json({ id }, { status: 201 })
}
