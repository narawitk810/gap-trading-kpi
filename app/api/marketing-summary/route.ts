import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

type RawRow = {
  id: string
  nickname: string
  date: string
  extra_data: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD in local time
  const date = searchParams.get('date') || today

  await ensureSchema()
  const db = getDb()

  const result = await db.execute({
    sql: "SELECT id, nickname, date, extra_data FROM kpi_entries WHERE department = 'การตลาด' AND date = ? ORDER BY created_at ASC",
    args: [date],
  })

  const rows: Record<string, unknown>[] = []

  for (const row of result.rows) {
    const r = row as unknown as RawRow
    let ex: Record<string, unknown> = {}
    try { ex = JSON.parse(r.extra_data || '{}') } catch { continue }

    // Flatten channels[] → low-ROI channels
    if (Array.isArray(ex.channels)) {
      for (const c of ex.channels as Record<string, unknown>[]) {
        rows.push({
          nickname: r.nickname,
          channel: String(c.channel || ''),
          isLowRoi: true,
          isBestRoi: false,
          live_staff_name: c.live_staff_name || '',
          live_hours: c.live_hours || '',
          ads_cost: c.ads_cost || '',
          gross_revenue: c.gross_revenue || '',
          roi: c.roi || '',
          cost_per_order: c.cost_per_order || '',
          cost_per_10sec_view: c.cost_per_10sec_view || '',
          avg_view_duration: c.avg_view_duration || '',
          new_followers: c.new_followers || '',
        })
      }
    }

    // best_roi → best ROI channel
    const best = ex.best_roi as Record<string, unknown> | undefined
    if (best?.channel) {
      rows.push({
        nickname: r.nickname,
        channel: String(best.channel),
        isLowRoi: false,
        isBestRoi: true,
        live_staff_name: best.live_staff_name || '',
        live_hours: best.live_hours || '',
        ads_cost: best.ads_cost || '',
        gross_revenue: best.gross_revenue || '',
        roi: best.roi || '',
        cost_per_order: best.cost_per_order || '',
        cost_per_10sec_view: best.cost_per_10sec_view || '',
        avg_view_duration: best.avg_view_duration || '',
        new_followers: best.new_followers || '',
      })
    }
  }

  return NextResponse.json({ date, rows })
}
