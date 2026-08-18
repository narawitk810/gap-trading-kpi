import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute('SELECT * FROM vip_customers ORDER BY firstname, lastname')
  const rows = result.rows.map((r) => ({
    ...r,
    gifts: JSON.parse((r.gifts as string) || '[]'),
    notify: JSON.parse((r.notify as string) || '[7]'),
    purchases: JSON.parse((r.purchases as string) || '{}'),
    promo_deductions: JSON.parse((r.promo_deductions as string) || '[]'),
    day: Number(r.day),
    month: Number(r.month),
  }))
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.id || !body.firstname || !body.lastname || !body.phone || !body.tier) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  await db.execute({
    sql: `INSERT INTO vip_customers
          (id, firstname, lastname, nickname, gender, tier, day, month, year,
           phone, email, line, tiktok, manager, address, note, interests,
           gifts, notify, gift_status, purchases, promo_deductions, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      body.id, body.firstname, body.lastname,
      body.nickname || '', body.gender || '', body.tier,
      body.day, body.month, body.year || '',
      body.phone, body.email || '', body.line || '',
      body.tiktok || '', body.manager || '',
      body.address || '', body.note || '', body.interests || '',
      JSON.stringify(body.gifts || []),
      JSON.stringify(body.notify || [7]),
      body.giftStatus || 'none',
      JSON.stringify(body.purchases || {}),
      JSON.stringify(body.promo_deductions || []),
      body.createdAt ? String(body.createdAt) : new Date().toISOString(),
    ],
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'ไม่มี id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  await db.execute({
    sql: `UPDATE vip_customers SET
          firstname=?, lastname=?, nickname=?, gender=?, tier=?,
          day=?, month=?, year=?, phone=?, email=?, line=?,
          tiktok=?, manager=?, address=?, note=?, interests=?,
          gifts=?, notify=?, gift_status=?, purchases=?, promo_deductions=?
          WHERE id=?`,
    args: [
      body.firstname, body.lastname, body.nickname || '', body.gender || '', body.tier,
      body.day, body.month, body.year || '', body.phone,
      body.email || '', body.line || '',
      body.tiktok || '', body.manager || '',
      body.address || '', body.note || '', body.interests || '',
      JSON.stringify(body.gifts || []),
      JSON.stringify(body.notify || [7]),
      body.giftStatus || 'none',
      JSON.stringify(body.purchases || {}),
      JSON.stringify(body.promo_deductions || []),
      body.id,
    ],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'ไม่มี id' }, { status: 400 })
  await ensureSchema()
  const db = getDb()
  await db.execute({ sql: 'DELETE FROM vip_customers WHERE id=?', args: [body.id] })
  return NextResponse.json({ ok: true })
}
