import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { notifyTournamentPromo } from '@/lib/line'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (id && searchParams.get('proxy') === '1') {
    const db = getDb()
    const row = await db.execute({ sql: 'SELECT image_data FROM tournament_promos WHERE id=?', args: [id] })
    const data = row.rows[0]?.image_data as string | undefined
    if (!data) return new Response(null, { status: 404 })
    if (data.startsWith('https://')) {
      const res = await fetch(data)
      const buf = await res.arrayBuffer()
      const ct = res.headers.get('content-type') || 'image/jpeg'
      return new Response(buf, { headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' } })
    }
    const [header, base64] = data.split(',')
    const contentType = header.replace('data:', '').replace(';base64', '')
    const buffer = Buffer.from(base64, 'base64')
    return new Response(buffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { image_data } = body

  if (!image_data) {
    return NextResponse.json({ error: 'กรุณาแนบรูปก่อนส่ง' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO tournament_promos (id, image_data, created_at) VALUES (?, ?, ?)`,
    args: [id, image_data, now],
  })

  await notifyTournamentPromo({ id, image_data })

  return NextResponse.json({ id }, { status: 201 })
}
