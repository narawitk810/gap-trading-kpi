import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const rows = await db.execute(
    'SELECT id, name, rank_name, rank_emoji, department, start_date FROM live_staff ORDER BY department, name'
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const employees = rows.rows.map((r) => {
    const startDate = r.start_date as string
    let days_worked: number | null = null
    let days_until_180: number | null = null

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      days_worked = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
      days_until_180 = 180 - days_worked
    }

    return {
      id: r.id,
      name: r.name,
      rank_name: r.rank_name,
      rank_emoji: r.rank_emoji,
      department: r.department,
      start_date: startDate || null,
      days_worked,
      days_until_180,
    }
  })

  return NextResponse.json(employees)
}

export async function PATCH(req: Request) {
  const { id, start_date } = await req.json()
  if (!id || !start_date) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const db = await getDb()
  await db.execute({
    sql: 'UPDATE live_staff SET start_date=? WHERE id=?',
    args: [start_date, id],
  })

  return NextResponse.json({ ok: true })
}
