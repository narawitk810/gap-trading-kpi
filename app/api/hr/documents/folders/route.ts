import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET() {
  const db = await getDb()
  const folders = await db.execute(
    'SELECT id, name, created_at FROM hr_folders ORDER BY created_at DESC'
  )
  const counts = await db.execute(
    'SELECT folder_id, COUNT(*) as cnt FROM hr_files GROUP BY folder_id'
  )
  const countMap: Record<string, number> = {}
  for (const r of counts.rows) {
    countMap[r.folder_id as string] = Number(r.cnt)
  }
  const result = folders.rows.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    file_count: countMap[r.id as string] ?? 0,
  }))
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'ชื่อโฟลเดอร์ไม่ถูกต้อง' }, { status: 400 })
  const db = await getDb()
  const id = randomUUID()
  await db.execute({
    sql: 'INSERT INTO hr_folders (id, name, created_at) VALUES (?, ?, ?)',
    args: [id, name.trim(), new Date().toISOString()],
  })
  return NextResponse.json({ id, name: name.trim() })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM hr_files WHERE folder_id=?', args: [id] })
  await db.execute({ sql: 'DELETE FROM hr_folders WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}
