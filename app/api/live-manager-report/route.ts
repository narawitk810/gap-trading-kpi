import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { imageUrl, nickname } = await request.json()
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_MANAGEMENT
  if (!token || !groupId) return NextResponse.json({ error: 'LINE ยังไม่ได้ตั้งค่า' }, { status: 500 })
  if (!imageUrl?.startsWith('https://')) return NextResponse.json({ error: 'กรุณาแนบรูปก่อน' }, { status: 400 })

  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  const messages = [
    { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl },
    { type: 'text', text: `📸 รายงาน\n👤 ${nickname || '-'}\n📅 ${date}` },
  ]

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: groupId, messages }),
  })
  if (!res.ok) return NextResponse.json({ error: 'ส่ง LINE ไม่สำเร็จ' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
