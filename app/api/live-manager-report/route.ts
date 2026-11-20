import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  const { imageBase64, nickname } = await request.json()
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_MANAGEMENT
  if (!token || !groupId) return NextResponse.json({ error: 'LINE ยังไม่ได้ตั้งค่า' }, { status: 500 })
  if (!imageBase64?.startsWith('data:')) return NextResponse.json({ error: 'กรุณาแนบรูปก่อน' }, { status: 400 })

  // Upload base64 → Vercel Blob server-side
  const [header, data] = imageBase64.split(',')
  const contentType = header.replace('data:', '').replace(';base64', '')
  const buffer = Buffer.from(data, 'base64')
  const ext = contentType.includes('jpeg') ? 'jpg' : (contentType.split('/')[1] || 'jpg')
  const filename = `report-${Date.now()}.${ext}`
  const blob = await put(filename, buffer, { access: 'public', contentType })

  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  const messages = [
    { type: 'image', originalContentUrl: blob.url, previewImageUrl: blob.url },
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
