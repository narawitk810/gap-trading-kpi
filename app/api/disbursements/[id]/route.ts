import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { action } = body

  if (!action) {
    return NextResponse.json({ error: 'กรุณาระบุ action' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const now = new Date().toISOString()

  if (action === 'approve') {
    if (
      !body.approved_by?.trim() ||
      !body.transfer_amount ||
      isNaN(Number(body.transfer_amount)) ||
      Number(body.transfer_amount) <= 0 ||
      !body.payment_slip
    ) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลการอนุมัติให้ครบถ้วน' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET status='approved', approved_by=?, transfer_amount=?, payment_slip=?, approved_at=?
            WHERE id=? AND status='pending_approval'`,
      args: [body.approved_by.trim(), Number(body.transfer_amount), body.payment_slip, now, params.id],
    })
  } else if (action === 'order') {
    if (
      !body.ordered_by?.trim() ||
      !body.actual_amount ||
      isNaN(Number(body.actual_amount)) ||
      Number(body.actual_amount) <= 0
    ) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลการสั่งซื้อให้ครบถ้วน' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET status='ordered', ordered_by=?, actual_amount=?, order_note=?, ordered_at=?
            WHERE id=? AND status='approved'`,
      args: [
        body.ordered_by.trim(),
        Number(body.actual_amount),
        body.order_note?.trim() || '',
        now,
        params.id,
      ],
    })
  } else if (action === 'record_payment') {
    if (!body.payment_note?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกรายละเอียดการจ่าย' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET status='payment_recorded', payment_note=?, remaining_note=?, payment_recorded_at=?
            WHERE id=? AND status='ordered'`,
      args: [body.payment_note.trim(), body.remaining_note?.trim() || '', now, params.id],
    })
  } else if (action === 'close_month') {
    if (!body.close_month?.trim() || !body.closed_by?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุเดือนและผู้ปิดงบ' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET status='monthly_closed', close_month=?, closed_by=?, closed_at=?
            WHERE id=? AND status='payment_recorded'`,
      args: [body.close_month.trim(), body.closed_by.trim(), now, params.id],
    })
  } else if (action === 'skip_to_approved') {
    await db.execute({
      sql: `UPDATE disbursements SET status='approved' WHERE id=? AND status='pending_approval'`,
      args: [params.id],
    })
  } else if (action === 'clear_slip') {
    await db.execute({
      sql: `UPDATE disbursements SET payment_slip='' WHERE id=?`,
      args: [params.id],
    })
  } else {
    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
