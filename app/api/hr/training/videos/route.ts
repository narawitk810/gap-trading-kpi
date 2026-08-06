import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  if (m) return m[1]
  const trimmed = url.trim()
  return trimmed.length === 11 ? trimmed : null
}

export async function GET() {
  const db = await getDb()
  const videos = await db.execute(
    'SELECT id, title, youtube_id, description, created_at FROM training_videos ORDER BY created_at DESC'
  )
  const counts = await db.execute(
    'SELECT video_id, COUNT(*) as cnt FROM training_completions GROUP BY video_id'
  )
  const countMap: Record<string, number> = {}
  for (const r of counts.rows) {
    countMap[r.video_id as string] = Number(r.cnt)
  }
  return NextResponse.json(
    videos.rows.map((r) => ({ ...r, completion_count: countMap[r.id as string] ?? 0 }))
  )
}

export async function POST(req: Request) {
  const { title, youtube_url, description } = await req.json()
  const youtubeId = extractYoutubeId(youtube_url ?? '')
  if (!title?.trim() || !youtubeId) {
    return NextResponse.json({ error: 'ชื่อคลิปหรือ YouTube URL ไม่ถูกต้อง' }, { status: 400 })
  }
  const db = await getDb()
  const id = randomUUID()
  await db.execute({
    sql: 'INSERT INTO training_videos (id, title, youtube_id, description, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, title.trim(), youtubeId, description?.trim() ?? '', new Date().toISOString()],
  })
  return NextResponse.json({ id, youtube_id: youtubeId })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM training_completions WHERE video_id=?', args: [id] })
  await db.execute({ sql: 'DELETE FROM training_videos WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}
