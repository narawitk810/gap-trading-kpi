import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema, generateId } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STORE_HOURS: Record<number, { open: number; close: number }> = {
  3: { open: 15, close: 20 },
  4: { open: 15, close: 20 },
  5: { open: 15, close: 20 },
  6: { open: 12, close: 21 },
}

const DAY_NAMES: Record<number, string> = {
  3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์', 6: 'เสาร์',
}

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await db.execute({
      sql: 'SELECT id, name, phone, date, start_hour, duration, people, note, status, created_at FROM tcg_time_bookings WHERE id = ?',
      args: [id],
    })
    return NextResponse.json({ booking: row.rows[0] || null })
  }

  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'ต้องระบุวันที่หรือ id' }, { status: 400 })

  const rows = await db.execute({
    sql: 'SELECT id, name, phone, date, start_hour, duration, people, note, status, created_at FROM tcg_time_bookings WHERE date = ? ORDER BY start_hour, created_at',
    args: [date],
  })

  return NextResponse.json({ date, bookings: rows.rows })
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { name, phone, date, start_hour, duration, people, note } = body

  if (!name?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อ' }, { status: 400 })
  if (!phone?.trim()) return NextResponse.json({ error: 'กรุณากรอกเบอร์โทร' }, { status: 400 })
  if (!date) return NextResponse.json({ error: 'กรุณาเลือกวันที่' }, { status: 400 })
  if (start_hour === undefined || start_hour === null) return NextResponse.json({ error: 'กรุณาเลือกเวลาเริ่ม' }, { status: 400 })
  if (!duration || duration < 1) return NextResponse.json({ error: 'จองขั้นต่ำ 1 ชั่วโมง' }, { status: 400 })
  if (!people || people < 3) return NextResponse.json({ error: 'ต้องมาอย่างน้อย 3 คน' }, { status: 400 })

  const dayOfWeek = new Date(date + 'T12:00:00').getDay()
  const hours = STORE_HOURS[dayOfWeek]
  if (!hours) {
    const openDays = Object.values(DAY_NAMES).join(', ')
    return NextResponse.json({ error: `ร้านเปิดให้จองเฉพาะวัน${openDays} เท่านั้น` }, { status: 400 })
  }

  if (start_hour < hours.open || start_hour >= hours.close) {
    return NextResponse.json({
      error: `วัน${DAY_NAMES[dayOfWeek]} เปิดให้จองเวลา ${hours.open}:00–${hours.close}:00 น.`,
    }, { status: 400 })
  }

  if (start_hour + duration > hours.close) {
    return NextResponse.json({
      error: `เวลาสิ้นสุด (${start_hour + duration}:00 น.) เกินเวลาปิดร้าน (${hours.close}:00 น.)`,
    }, { status: 400 })
  }

  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: 'INSERT INTO tcg_time_bookings (id, name, phone, date, start_hour, duration, people, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, name.trim(), phone.trim(), date, start_hour, duration, people, note?.trim() || '', 'pending', now],
  })

  return NextResponse.json({ id, message: 'จองเวลาสำเร็จ' })
}

export async function PATCH(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { id, status } = body

  if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })
  if (!['confirmed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'status ต้องเป็น confirmed หรือ cancelled' }, { status: 400 })
  }

  await db.execute({
    sql: 'UPDATE tcg_time_bookings SET status = ? WHERE id = ?',
    args: [status, id],
  })

  return NextResponse.json({ message: 'อัปเดตสถานะสำเร็จ' })
}
