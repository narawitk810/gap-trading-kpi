import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { sendLinePushMessage } from '@/lib/line'

export async function GET() {
  await ensureSchema()
  const db = getDb()
  const result = await db.execute('SELECT * FROM content_clips ORDER BY created_at DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body.clip_type === 'content') {
    if (!body.title?.trim() || !body.created_by?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
    }
    const assignees: string[] = Array.isArray(body.assigned_to)
      ? body.assigned_to.filter(Boolean) : []
    if (assignees.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน' }, { status: 400 })
    }
    await ensureSchema()
    const db = getDb()
    const now = new Date().toISOString()
    const ids: string[] = []
    for (const person of assignees) {
      const id = generateId()
      await db.execute({
        sql: `INSERT INTO content_clips
              (id, title, drive_link, shoot_date, created_by, status,
               assigned_to, assigned_at, clip_type, content_brief, created_at)
              VALUES (?, ?, ?, '', ?, 'assigned', ?, ?, 'content', ?, ?)`,
        args: [id, body.title.trim(), body.drive_link?.trim() || '',
               body.created_by.trim(), person, now,
               body.content_brief?.trim() || '', now],
      })
      ids.push(id)
    }
    const groupId = process.env.LINE_GROUP_ID_CREATIVE
    if (groupId) {
      const msg = [
        '📝 มอบหมาย Idea Content ใหม่',
        `💡 ไอเดีย: ${body.title.trim()}`,
        body.content_brief?.trim() ? `📄 Brief: ${body.content_brief.trim()}` : '',
        body.drive_link?.trim() ? `🔗 อ้างอิง: ${body.drive_link.trim()}` : '',
        `👥 มอบหมายให้: ${assignees.join(', ')}`,
        `สร้างโดย: ${body.created_by.trim()}`,
      ].filter(Boolean).join('\n')
      sendLinePushMessage(groupId, msg)
    }
    return NextResponse.json({ ids }, { status: 201 })
  }

  if (!body.title?.trim() || !body.drive_link?.trim() || !body.shoot_date || !body.created_by?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO content_clips (id, title, drive_link, shoot_date, created_by, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'raw', ?)`,
    args: [id, body.title.trim(), body.drive_link.trim(), body.shoot_date, body.created_by.trim(), now],
  })
  return NextResponse.json({ id }, { status: 201 })
}
