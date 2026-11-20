import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  let body: { imageBase64?: string; nickname?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }

  const { imageBase64, nickname } = body
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_MANAGEMENT

  if (!token || !groupId) return NextResponse.json({ error: 'LINE ยังไม่ได้ตั้งค่า (token/groupId missing)' }, { status: 500 })
  if (!imageBase64?.startsWith('data:')) return NextResponse.json({ error: 'กรุณาแนบรูปก่อน' }, { status: 400 })

  let blobUrl: string
  try {
    const [header, data] = imageBase64.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(data, 'base64')
    const ext = contentType.includes('jpeg') ? 'jpg' : (contentType.split('/')[1] || 'jpg')
    const filename = `report-${Date.now()}.${ext}`
    const blob = await put(filename, buffer, { access: 'public', contentType })
    blobUrl = blob.url
  } catch (err) {
    return NextResponse.json({ error: 'อัปโหลดรูปไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 })
  }

  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  const messages = [
    { type: 'image', originalContentUrl: blobUrl, previewImageUrl: blobUrl },
    { type: 'text', text: `📸 รายงาน\n👤 ${nickname || '-'}\n📅 ${date}` },
  ]

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages }),
    })
    if (!res.ok) {
      const lineErr = await res.text()
      return NextResponse.json({ error: `ส่ง LINE ไม่สำเร็จ (${res.status}): ${lineErr}` }, { status: 502 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'ส่ง LINE ไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)) }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
