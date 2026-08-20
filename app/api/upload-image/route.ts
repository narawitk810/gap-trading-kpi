import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { base64 } = await req.json()
  if (!base64 || !base64.startsWith('data:')) {
    return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
  }
  const [header, data] = base64.split(',')
  const contentType = header.replace('data:', '').replace(';base64', '')
  const buffer = Buffer.from(data, 'base64')
  const ext = contentType.includes('jpeg') ? 'jpg' : (contentType.split('/')[1] || 'jpg')
  const filename = `stock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const blob = await put(filename, buffer, { access: 'public', contentType })
  return NextResponse.json({ url: blob.url })
}
