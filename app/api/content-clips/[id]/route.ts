import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { action } = body
  await ensureSchema()
  const db = getDb()
  const now = new Date().toISOString()

  if (action === 'assign') {
    if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 401 })
    if (!body.assigned_to?.trim()) return NextResponse.json({ error: 'กรุณาเลือกชื่อพนักงาน' }, { status: 400 })
    await db.execute({
      sql: `UPDATE content_clips SET status='assigned', assigned_to=?, assigned_at=? WHERE id=? AND status='raw'`,
      args: [body.assigned_to.trim(), now, id],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'submit') {
    const links: Record<string, string> = body.platform_links || {}
    if (!Object.values(links).some((v) => v?.trim())) {
      return NextResponse.json({ error: 'กรุณาแนบลิ้งค์อย่างน้อย 1 platform' }, { status: 400 })
    }
    const row = await db.execute({ sql: `SELECT assigned_at FROM content_clips WHERE id=?`, args: [id] })
    const assignedAt = row.rows[0]?.assigned_at as string | null
    const days = assignedAt ? Math.round((new Date(now).getTime() - new Date(assignedAt).getTime()) / 86400000) : 0
    await db.execute({
      sql: `UPDATE content_clips SET status='reviewing', platform_links=?, submitted_at=?, days_to_submit=? WHERE id=? AND (status='assigned' OR status='submitted')`,
      args: [JSON.stringify(links), now, days, id],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'pass') {
    if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 401 })
    if (!body.reviewed_by?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ตรวจสอบ' }, { status: 400 })
    await db.execute({
      sql: `UPDATE content_clips SET status='recorded', review_result='pass', reviewed_by=?, reviewed_at=? WHERE id=? AND status='reviewing'`,
      args: [body.reviewed_by.trim(), now, id],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'revise') {
    if (body.key !== ADMIN_KEY) return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 401 })
    if (!body.reviewed_by?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ตรวจสอบ' }, { status: 400 })
    await db.execute({
      sql: `UPDATE content_clips SET status='submitted', review_result='revise', reviewed_by=?, reviewed_at=?, platform_links=NULL, submitted_at=NULL, days_to_submit=NULL WHERE id=? AND status='reviewing'`,
      args: [body.reviewed_by.trim(), now, id],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'record_result') {
    if (!body.views || !body.likes) return NextResponse.json({ error: 'กรุณากรอก views และ likes' }, { status: 400 })
    await db.execute({
      sql: `UPDATE content_clips SET views=?, avg_watch_time=?, likes=?, result_recorded_at=? WHERE id=? AND status='recorded' AND result_recorded_at IS NULL`,
      args: [Number(body.views), body.avg_watch_time?.trim() || '', Number(body.likes), now, id],
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
