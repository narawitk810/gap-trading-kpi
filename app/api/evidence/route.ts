import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    'SELECT id, employee_name, incident, incident_date, time_start, time_end, evidence_data, created_by, created_dept, created_at FROM disciplinary_evidence ORDER BY created_at DESC'
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.employee_name?.trim() || !body.incident?.trim() || !body.created_by?.trim() || !body.created_dept?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  if (!Array.isArray(body.evidence_data) || body.evidence_data.length === 0) {
    return NextResponse.json({ error: 'กรุณาแนบหลักฐานอย่างน้อย 1 รายการ' }, { status: 400 })
  }
  if (body.evidence_data.length > 10) {
    return NextResponse.json({ error: 'แนบหลักฐานได้สูงสุด 10 รายการ' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO disciplinary_evidence (id, employee_name, incident, incident_date, time_start, time_end, evidence_data, created_by, created_dept, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      body.employee_name.trim(),
      body.incident.trim(),
      body.incident_date?.trim() || '',
      body.time_start?.trim() || '',
      body.time_end?.trim() || '',
      JSON.stringify(body.evidence_data),
      body.created_by.trim(),
      body.created_dept.trim(),
      now,
    ],
  })

  return NextResponse.json({ id }, { status: 201 })
}
