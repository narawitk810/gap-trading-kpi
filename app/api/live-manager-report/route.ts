import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const BASE_URL = 'https://gap-trading-kpi.vercel.app'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return new Response(null, { status: 404 })
  await ensureSchema()
  const db = getDb()
  const row = await db.execute({ sql: 'SELECT image_data FROM live_manager_reports WHERE id=?', args: [id] })
  const dataUri = row.rows[0]?.image_data as string | undefined
  if (!dataUri) return new Response(null, { status: 404 })
  if (dataUri.startsWith('https://')) return Response.redirect(dataUri, 302)
  const [header, base64] = dataUri.split(',')
  const contentType = header.replace('data:', '').replace(';base64', '')
  return new Response(Buffer.from(base64, 'base64'), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
  })
}

export async function POST(request: NextRequest) {
  let body: { imageBase64?: string; nickname?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }

  const { imageBase64, nickname } = body
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_MANAGEMENT
  if (!token || !groupId) return NextResponse.json({ error: 'LINE ยังไม่ได้ตั้งค่า' }, { status: 500 })
  if (!imageBase64?.startsWith('data:')) return NextResponse.json({ error: 'กรุณาแนบรูปก่อน' }, { status: 400 })

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  await db.execute({
    sql: 'INSERT INTO live_manager_reports (id, image_data, created_at) VALUES (?, ?, ?)',
    args: [id, imageBase64, new Date().toISOString()],
  })

  const imageUrl = `${BASE_URL}/api/live-manager-report?id=${id}`
  const now = new Date()
  const date = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  const time = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const messages = [
    { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl },
    { type: 'text', text: `รายงานการประชุม\n📅 ${date}\n⏰ ${time}` },
  ]

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: groupId, messages }),
  })
  if (!res.ok) {
    const lineErr = await res.text()
    return NextResponse.json({ error: `ส่ง LINE ไม่สำเร็จ (${res.status}): ${lineErr}` }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
