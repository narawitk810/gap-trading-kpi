import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { notifyLeaveRequest } from '@/lib/line'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute(
    `SELECT id, employee_name, department, leave_type, request_type, start_date, end_date,
            num_days, reason, document_data, status, reviewed_by, rejection_reason, created_at
     FROM leave_requests ORDER BY created_at DESC`
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { employee_name, department, leave_type, request_type, start_date, end_date, num_days, reason, document_data } = body

  if (!employee_name?.trim() || !department?.trim() || !leave_type || !request_type || !start_date || !end_date || !reason?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO leave_requests (id, employee_name, department, leave_type, request_type, start_date, end_date, num_days, reason, document_data, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [id, employee_name.trim(), department.trim(), leave_type, request_type, start_date, end_date, num_days || 1, reason.trim(), document_data || null, now],
  })

  await notifyLeaveRequest({
    id,
    employee_name: employee_name.trim(),
    department: department.trim(),
    leave_type,
    request_type,
    start_date,
    end_date,
    num_days: num_days || 1,
    reason: reason.trim(),
  })

  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, status, reviewed_by, rejection_reason } = body

  if (!id || !status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  if (status === 'rejected' && !rejection_reason?.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  await db.execute({
    sql: `UPDATE leave_requests SET status=?, reviewed_by=?, rejection_reason=? WHERE id=?`,
    args: [status, reviewed_by?.trim() || null, rejection_reason?.trim() || null, id],
  })

  return NextResponse.json({ ok: true })
}
