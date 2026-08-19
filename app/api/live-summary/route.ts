import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

type RawRow = {
  nickname: string
  time: string
  channel_name: string
  obstacles: string
  extra_data: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const today = new Date().toLocaleDateString('sv-SE')
  const date = searchParams.get('date') || today

  await ensureSchema()
  const db = getDb()

  const result = await db.execute({
    sql: "SELECT nickname, time, channel_name, obstacles, extra_data FROM kpi_entries WHERE department = 'ไลฟ์สด' AND date = ? ORDER BY created_at ASC",
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
      obstacles: r.obstacles || '',
      tiktok_start: String(ex.tiktok_start || ''),
      tiktok_end:   String(ex.tiktok_end   || ''),
      fb_start:     String(ex.fb_start     || ''),
      fb_end:       String(ex.fb_end       || ''),
      sales_shopee:          String(ex.sales_shopee          || ''),
      sales_tiktok:          String(ex.sales_tiktok          || ''),
      sales_outside_tiktok:  String(ex.sales_outside_tiktok  || ''),
      sales_outside_fb:      String(ex.sales_outside_fb      || ''),
      suggestions:           String(ex.suggestions           || ''),
      note:                  String(ex.note                  || ''),
      // backwards compat
      live_hours:   String(ex.live_hours   || ''),
      sales_amount: String(ex.sales_amount || ''),
    }
  })

  return NextResponse.json({ date, rows })
}
