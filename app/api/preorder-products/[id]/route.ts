import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute({ sql: 'SELECT * FROM preorder_products WHERE id=?', args: [params.id] })
  if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  await ensureSchema()
  const db = getDb()

  if ('is_active' in body) {
    await db.execute({
      sql: 'UPDATE preorder_products SET is_active=? WHERE id=?',
      args: [body.is_active ? 1 : 0, params.id],
    })
  } else {
    if (!body.name?.trim() || !body.close_date?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าและวันปิดรับออเดอร์' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE preorder_products SET name=?, description=?, price=?, close_date=?, release_date=?, max_qty=?, image_data=? WHERE id=?`,
      args: [
        body.name.trim(),
        body.description?.trim() || '',
        Number(body.price) || 0,
        body.close_date.trim(),
        body.release_date?.trim() || '',
        Number(body.max_qty) || 0,
        body.image_data || '',
        params.id,
      ],
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM preorder_products WHERE id=?', args: [params.id] })
  await db.execute({ sql: 'DELETE FROM preorder_orders WHERE product_id=?', args: [params.id] })

  return NextResponse.json({ ok: true })
}
