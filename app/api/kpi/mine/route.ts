import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nickname = searchParams.get('nickname')?.trim()
  const month = searchParams.get('month') // YYYY-MM

  if (!nickname || !month) {
    return NextResponse.json({ error: 'กรุณาระบุ nickname และ month' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()

  const result = await db.execute({
    sql: `SELECT id, department, date, time, nickname, channel_name, tasks, obstacles, extra_data, created_at
          FROM kpi_entries
          WHERE nickname = ? AND date LIKE ?
          ORDER BY date ASC, created_at ASC`,
    args: [nickname, `${month}-%`],
  })

  const rows = result.rows.map((row) => {
    const r = row as Record<string, unknown>
    let extra: Record<string, unknown> = {}
    try { extra = JSON.parse(String(r.extra_data || '{}')) } catch { /* */ }
    let tasks: string[] = []
    try { tasks = JSON.parse(String(r.tasks || '[]')) } catch { /* */ }
    return {
      id: r.id,
      department: r.department,
      date: r.date,
      time: r.time,
      nickname: r.nickname,
      channels: String(r.channel_name || '').split(', ').filter(Boolean),
      tasks,
      obstacles: r.obstacles || '',
      extra,
      created_at: r.created_at,
    }
  })

  return NextResponse.json({ month, nickname, entries: rows })
}
