import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'
import { appendKPIRow } from '@/lib/sheets'
import type { KPIEntryCreate } from '@/types/kpi'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

type RawRow = {
  id: string
  department: string
  date: string
  time: string
  nickname: string
  channel_name: string
  tasks: string
  obstacles: string
  extra_data: string
  created_at: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchema()
  const db = getDb()

  const department = searchParams.get('department')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const nickname = searchParams.get('nickname')

  let query = 'SELECT * FROM kpi_entries WHERE 1=1'
  const args: string[] = []

  if (department) { query += ' AND department = ?'; args.push(department) }
  if (dateFrom)   { query += ' AND date >= ?';       args.push(dateFrom) }
  if (dateTo)     { query += ' AND date <= ?';       args.push(dateTo) }
  if (nickname)   { query += ' AND nickname LIKE ?'; args.push(`%${nickname}%`) }

  query += ' ORDER BY created_at DESC'

  const result = await db.execute({ sql: query, args })
  const entries = result.rows.map((row) => {
    const r = row as unknown as RawRow
    return {
      ...r,
      tasks: JSON.parse(r.tasks),
      extra_data: r.extra_data || '',
    }
  })

  return NextResponse.json(entries)
}

export async function POST(request: NextRequest) {
  const body: KPIEntryCreate = await request.json()

  const CHANNEL_DEPTS = ['ไลฟ์สด', 'การตลาด', 'Creative']
  const needsChannel = CHANNEL_DEPTS.includes(body.department)
  if (!body.department || !body.date || !body.nickname?.trim() ||
      (needsChannel && !body.channel_name?.trim())) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  const validTasks = (body.tasks || []).filter((t) => t.trim())
  if (validTasks.length === 0) {
    return NextResponse.json({ error: 'กรุณากรอกสิ่งที่ทำอย่างน้อย 1 รายการ' }, { status: 400 })
  }
  if (validTasks.length > 10) {
    return NextResponse.json({ error: 'สิ่งที่ทำวันนี้มีได้สูงสุด 10 รายการ' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()

  const id = generateId()
  const now = new Date().toISOString()
  const extraDataStr =
    body.extra_data && Object.keys(body.extra_data).length > 0
      ? JSON.stringify(body.extra_data)
      : ''

  const entry = {
    id,
    department: body.department,
    date: body.date,
    time: body.time || '',
    nickname: body.nickname.trim(),
    channel_name: body.channel_name.trim(),
    tasks: validTasks,
    obstacles: body.obstacles?.trim() || '',
    extra_data: extraDataStr,
    created_at: now,
  }

  await db.execute({
    sql: `INSERT INTO kpi_entries (id, department, date, time, nickname, channel_name, tasks, obstacles, extra_data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.id, entry.department, entry.date, entry.time,
      entry.nickname, entry.channel_name,
      JSON.stringify(entry.tasks), entry.obstacles,
      entry.extra_data, entry.created_at,
    ],
  })

  appendKPIRow(entry)

  return NextResponse.json({ id }, { status: 201 })
}
