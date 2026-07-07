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
    const pm = body.payment_method as string
    const ch = body.order_channel as string
    if (
      !body.ordered_by?.trim() ||
      body.actual_amount === undefined ||
      body.actual_amount === null ||
      body.actual_amount === '' ||
      isNaN(Number(body.actual_amount)) ||
      Number(body.actual_amount) < 0 ||
      !['เบิก', 'สำรองจ่าย', 'qr', 'มีอยู่แล้ว'].includes(pm) ||
      (ch !== 'offline' && ch !== 'online') ||
      !body.order_channel_image
    ) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลการสั่งซื้อให้ครบถ้วน' }, { status: 400 })
    }
    if (pm === 'เบิก' && (!body.order_disburse_slip || !body.order_pay_slip)) {
      return NextResponse.json({ error: 'กรุณาแนบสลิปขอเบิกและสลิปชำระเงิน' }, { status: 400 })
    }
    if (pm === 'สำรองจ่าย' && !body.advance_slip) {
      return NextResponse.json({ error: 'กรุณาแนบสลิปสำรองจ่าย' }, { status: 400 })
    }
    if (pm === 'qr' && !body.qr_slip) {
      return NextResponse.json({ error: 'กรุณาแนบ QR Code' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET status='ordered', ordered_by=?, actual_amount=?, order_note=?, ordered_at=?,
                payment_method=?, order_disburse_slip=?, order_pay_slip=?, advance_slip=?,
                order_channel=?, order_channel_image=?, qr_slip=?
            WHERE id=? AND status='approved'`,
      args: [
        body.ordered_by.trim(),
        Number(body.actual_amount),
        body.order_note?.trim() || '',
        now,
        pm,
        pm === 'เบิก' ? body.order_disburse_slip : '',
        pm === 'เบิก' ? body.order_pay_slip : '',
        pm === 'สำรองจ่าย' ? body.advance_slip : '',
        ch,
        body.order_channel_image,
        pm === 'qr' ? body.qr_slip : '',
        params.id,
      ],
    })
  } else if (action === 'reimburse') {
    if (!body.reimbursement_slip) {
      return NextResponse.json({ error: 'กรุณาแนบสลิปการจ่ายคืน' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET reimbursed_at=?, reimbursement_slip=?
            WHERE id=? AND status='ordered' AND (payment_method='สำรองจ่าย' OR payment_method='qr') AND reimbursed_at=''`,
      args: [now, body.reimbursement_slip, params.id],
    })
  } else if (action === 'record_payment') {
    const tis = body.tax_invoice_status as string
    if (!['yes', 'no'].includes(tis)) {
      return NextResponse.json({ error: 'กรุณาระบุสถานะใบกำกับภาษี' }, { status: 400 })
    }
    if (tis === 'yes' && !body.tax_invoice_image) {
      return NextResponse.json({ error: 'กรุณาแนบรูปใบกำกับภาษี' }, { status: 400 })
    }
    if (tis === 'no' && !body.tax_invoice_no_reason?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่ไม่มีใบกำกับภาษี' }, { status: 400 })
    }
    const rows = await db.execute({
      sql: `SELECT payment_method, reimbursed_at FROM disbursements WHERE id=? AND status='ordered'`,
      args: [params.id],
    })
    const row = rows.rows[0]
    if (row && ['สำรองจ่าย', 'qr'].includes(row.payment_method as string) && !row.reimbursed_at) {
      return NextResponse.json({ error: row.payment_method === 'qr' ? 'กรุณารอบริษัทชำระก่อน' : 'กรุณารอการจ่ายคืนจากบริษัทก่อน' }, { status: 400 })
    }
    await db.execute({
      sql: `UPDATE disbursements
            SET status='payment_recorded', payment_note=?, remaining_note=?, payment_recorded_at=?,
                tax_invoice_status=?, tax_invoice_image=?, tax_invoice_no_reason=?
            WHERE id=? AND status='ordered'`,
      args: [
        body.payment_note.trim(),
        body.remaining_note?.trim() || '',
        now,
        tis,
        tis === 'yes' ? body.tax_invoice_image : '',
        tis === 'no' ? body.tax_invoice_no_reason.trim() : '',
        params.id,
      ],
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
  } else if (action === 'rollback_to_pending') {
    await db.execute({
      sql: `UPDATE disbursements
            SET status='pending_approval',
                approved_by='', transfer_amount=NULL, payment_slip='', approved_at=''
            WHERE id=? AND status='approved'`,
      args: [params.id],
    })
  } else if (action === 'rollback_to_approved') {
    await db.execute({
      sql: `UPDATE disbursements
            SET status='approved',
                ordered_by='', actual_amount=NULL, order_note='', ordered_at='',
                payment_method='', order_disburse_slip='', order_pay_slip='',
                advance_slip='', reimbursed_at='', reimbursement_slip='',
                order_channel='', order_channel_image='', qr_slip=''
            WHERE id=? AND status='ordered'`,
      args: [params.id],
    })
  } else if (action === 'rollback_to_ordered') {
    await db.execute({
      sql: `UPDATE disbursements
            SET status='ordered',
                payment_note='', remaining_note='', payment_recorded_at='',
                tax_invoice_status='', tax_invoice_image='', tax_invoice_no_reason=''
            WHERE id=? AND status='payment_recorded'`,
      args: [params.id],
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
