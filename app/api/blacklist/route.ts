import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, customer_name, reason, incident_date, image_data, reported_by, created_at
     FROM customer_blacklist ORDER BY incident_date DESC, created_at DESC`
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customer_name, reason, incident_date, image_data, reported_by } = body

  if (!customer_name?.trim() || !reason?.trim() || !incident_date || !reported_by?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO customer_blacklist (id, customer_name, reason, incident_date, image_data, reported_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, customer_name.trim(), reason.trim(), incident_date, image_data || null, reported_by.trim(), now],
  })

  return NextResponse.json({ id }, { status: 201 })
}
