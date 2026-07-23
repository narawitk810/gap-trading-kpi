import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema, generateId } from '@/lib/db'

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const nickname = searchParams.get('nickname')?.trim()
  const phone = searchParams.get('phone')?.trim()
  const branch = searchParams.get('branch') || 'gap7card'

  // ไม่มี params → return list ทั้งหมด (สำหรับ admin)
  if (!nickname && !phone) {
    const listResult = await db.execute({
      sql: 'SELECT id, full_name, nickname, phone, date_of_birth, created_at FROM tcg_members WHERE branch=? ORDER BY created_at DESC',
      args: [branch],
    })
    return NextResponse.json(listResult.rows)
  }

  if (!nickname || !phone) {
    return NextResponse.json({ error: 'กรุณากรอกฉายาและเบอร์โทร' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'SELECT nickname, full_name FROM tcg_members WHERE branch=? AND nickname=? AND phone=?',
    args: [branch, nickname, phone],
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก กรุณาตรวจสอบฉายาและเบอร์โทรอีกครั้ง' }, { status: 404 })
  }

  const row = result.rows[0]
  return NextResponse.json({ nickname: row.nickname, full_name: row.full_name })
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const full_name = (body.full_name as string)?.trim()
  const phone = (body.phone as string)?.trim()
  const nickname = (body.nickname as string)?.trim()
  const date_of_birth = (body.date_of_birth as string)?.trim() || ''
  const branch = (body.branch as string) || 'gap7card'

  if (!full_name || !phone || !nickname) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  if (!/^[0-9]{9,10}$/.test(phone)) {
    return NextResponse.json({ error: 'เบอร์โทรไม่ถูกต้อง (ตัวเลข 9-10 หลัก)' }, { status: 400 })
  }

  try {
    await db.execute({
      sql: 'INSERT INTO tcg_members (id, branch, full_name, phone, nickname, date_of_birth, created_at) VALUES (?,?,?,?,?,?,?)',
      args: [generateId(), branch, full_name, phone, nickname, date_of_birth, new Date().toISOString()],
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE')) {
      if (msg.includes('nickname')) {
        return NextResponse.json({ error: 'ฉายานี้มีคนใช้แล้ว กรุณาเลือกฉายาอื่น' }, { status: 409 })
      }
      if (msg.includes('phone')) {
        return NextResponse.json({ error: 'เบอร์โทรนี้สมัครสมาชิกไปแล้ว กรุณาเข้าสู่ระบบ' }, { status: 409 })
      }
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 })
  }
}
