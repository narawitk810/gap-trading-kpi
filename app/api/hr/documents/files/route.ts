import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const folder_id = searchParams.get('folder_id')
  if (!folder_id) return NextResponse.json({ error: 'ไม่พบ folder_id' }, { status: 400 })
  const db = await getDb()
  const rows = await db.execute({
    sql: 'SELECT id, folder_id, name, file_type, file_size, created_at FROM hr_files WHERE folder_id=? ORDER BY name',
    args: [folder_id],
  })
  return NextResponse.json(rows.rows)
}

export async function POST(req: Request) {
  const { folder_id, name, file_type, file_size, file_data } = await req.json()
  if (!folder_id || !name || !file_data) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const db = await getDb()
  const id = randomUUID()
  await db.execute({
    sql: 'INSERT INTO hr_files (id, folder_id, name, file_type, file_size, file_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, folder_id, name, file_type ?? '', file_size ?? 0, file_data, new Date().toISOString()],
  })
  return NextResponse.json({ id })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM hr_files WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}
