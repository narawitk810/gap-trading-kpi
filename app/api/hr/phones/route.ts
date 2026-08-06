import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

function daysUntilExpire(expireDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expireDate)
  exp.setHours(0, 0, 0, 0)
  return Math.floor((exp.getTime() - today.getTime()) / 86_400_000)
}

export async function GET() {
  const db = await getDb()
  const rows = await db.execute(
    'SELECT id, name, phone, provider, expire_date, note, created_at FROM phone_numbers ORDER BY expire_date ASC'
  )
  const result = rows.rows.map((r) => ({
    ...r,
    days_until_expire: daysUntilExpire(r.expire_date as string),
  }))
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const { name, phone, provider, expire_date, note } = await req.json()
  if (!name?.trim() || !phone?.trim() || !expire_date) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const db = await getDb()
  const id = randomUUID()
  await db.execute({
    sql: 'INSERT INTO phone_numbers (id, name, phone, provider, expire_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, name.trim(), phone.trim(), provider?.trim() ?? '', expire_date, note?.trim() ?? '', new Date().toISOString()],
  })
  return NextResponse.json({ id })
}

export async function PATCH(req: Request) {
  const { id, name, phone, provider, expire_date, note } = await req.json()
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })
  const db = await getDb()
  await db.execute({
    sql: `UPDATE phone_numbers SET
      name        = COALESCE(?, name),
      phone       = COALESCE(?, phone),
      provider    = COALESCE(?, provider),
      expire_date = COALESCE(?, expire_date),
      note        = COALESCE(?, note)
      WHERE id = ?`,
    args: [name ?? null, phone ?? null, provider ?? null, expire_date ?? null, note ?? null, id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM phone_numbers WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}
