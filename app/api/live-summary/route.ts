import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

type RawRow = {
  nickname: string
  time: string
  channel_name: string
  extra_data: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const today = new Date().toLocaleDateString('sv-SE')
  const date = searchParams.get('date') || today

  await ensureSchema()
  const db = getDb()

  const result = await db.execute({
    sql: "SELECT nickname, time, channel_name, extra_data FROM kpi_entries WHERE department = 'ไลฟ์สด' AND date = ? ORDER BY created_at ASC",
    args: [date],
  })

  const rows = result.rows.map((row) => {
    const r = row as unknown as RawRow
    let ex: Record<string, unknown> = {}
    try { ex = JSON.parse(r.extra_data || '{}') } catch { /* */ }
    return {
      nickname: r.nickname,
      time: r.time,
      channels: r.channel_name ? r.channel_name.split(', ').filter(Boolean) : [],
      live_hours: String(ex.live_hours || ''),
      sales_amount: String(ex.sales_amount || ''),
    }
  })

  return NextResponse.json({ date, rows })
}
