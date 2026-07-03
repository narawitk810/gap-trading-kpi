import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema, generateId } from '@/lib/db'

const MAX_PER_SLOT = 3

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'ต้องระบุวันที่' }, { status: 400 })

  const rows = await db.execute({
    sql: 'SELECT id, nickname, hour_slot FROM break_bookings WHERE date = ? ORDER BY hour_slot, created_at',
    args: [date],
  })

  // group by hour_slot
  const slots: Record<number, { id: string; nickname: string }[]> = {}
  for (const row of rows.rows) {
    const h = row.hour_slot as number
    if (!slots[h]) slots[h] = []
    slots[h].push({ id: row.id as string, nickname: row.nickname as string })
  }

  return NextResponse.json({ slots })
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { nickname, date, hour_slot } = body

  if (!nickname?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อเล่น' }, { status: 400 })
  if (!date) return NextResponse.json({ error: 'ต้องระบุวันที่' }, { status: 400 })
  if (hour_slot === undefined || hour_slot === null) return NextResponse.json({ error: 'ต้องระบุช่วงเวลา' }, { status: 400 })

  // ตรวจสอบว่าคนนี้จองช่วงนี้แล้วหรือยัง
  const existing = await db.execute({
    sql: 'SELECT id FROM break_bookings WHERE date = ? AND hour_slot = ? AND nickname = ?',
    args: [date, hour_slot, nickname.trim()],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'คุณจองช่วงเวลานี้ไว้แล้ว' }, { status: 409 })
  }

  // นับจำนวนคนในช่วงนี้
  const count = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM break_bookings WHERE date = ? AND hour_slot = ?',
    args: [date, hour_slot],
  })
  const cnt = count.rows[0].cnt as number
  if (cnt >= MAX_PER_SLOT) {
    return NextResponse.json({ error: 'ช่วงเวลานี้เต็มแล้ว (ไม่เกิน 3 คน)' }, { status: 409 })
  }

  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: 'INSERT INTO break_bookings (id, nickname, date, hour_slot, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, nickname.trim(), date, hour_slot, now],
  })

  return NextResponse.json({ id, message: 'จองพักสำเร็จ' })
}

export async function DELETE(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })

  await db.execute({ sql: 'DELETE FROM break_bookings WHERE id = ?', args: [id] })
  return NextResponse.json({ message: 'ยกเลิกการจองแล้ว' })
}
