import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema, generateId } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nickname = searchParams.get('nickname')?.trim()
  const date = searchParams.get('date')   // YYYY-MM-DD
  const month = searchParams.get('month') // YYYY-MM

  if (!nickname) return NextResponse.json({ error: 'กรุณาระบุ nickname' }, { status: 400 })

  await ensureSchema()
  const db = getDb()

  if (date) {
    const [sales, gifts, logs] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM live_sales_report WHERE nickname=? AND date=? ORDER BY created_at ASC', args: [nickname, date] }),
      db.execute({ sql: 'SELECT * FROM live_gifts WHERE nickname=? AND date=? ORDER BY created_at ASC', args: [nickname, date] }),
      db.execute({ sql: 'SELECT * FROM live_daily_log WHERE nickname=? AND date=?', args: [nickname, date] }),
    ])
    return NextResponse.json({ date, nickname, sales: sales.rows, gifts: gifts.rows, daily_log: logs.rows[0] ?? null })
  }

  if (month) {
    const [sales, gifts, logs] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM live_sales_report WHERE nickname=? AND date LIKE ? ORDER BY date ASC, created_at ASC', args: [nickname, `${month}-%`] }),
      db.execute({ sql: 'SELECT * FROM live_gifts WHERE nickname=? AND date LIKE ? ORDER BY date ASC, created_at ASC', args: [nickname, `${month}-%`] }),
      db.execute({ sql: 'SELECT * FROM live_daily_log WHERE nickname=? AND date LIKE ? ORDER BY date ASC', args: [nickname, `${month}-%`] }),
    ])
    return NextResponse.json({ month, nickname, sales: sales.rows, gifts: gifts.rows, daily_logs: logs.rows })
  }

  return NextResponse.json({ error: 'กรุณาระบุ date หรือ month' }, { status: 400 })
}

interface SalesRow { product_name: string; qty_box: number; qty_pack: number; amount: number; platform: string; note: string }
interface GiftRow  { gift_name: string; promo_type: string; qty: number; unit: string; price: number; note: string }
interface DailyLog {
  tiktok_start: string; tiktok_end: string
  fb_start: string; fb_end: string
  sales_shopee: number; sales_tiktok: number
  sales_outside_tiktok: number; sales_outside_fb: number
  obstacles: string; suggestions: string; note: string
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    nickname: string
    date: string
    sales?: SalesRow[]
    gifts?: GiftRow[]
    daily_log?: Partial<DailyLog>
  }

  const { nickname, date, sales = [], gifts = [], daily_log } = body
  if (!nickname?.trim() || !date) return NextResponse.json({ error: 'nickname และ date จำเป็น' }, { status: 400 })

  await ensureSchema()
  const db = getDb()
  const now = new Date().toISOString()

  if (daily_log) {
    const dl = daily_log
    await db.execute({
      sql: `INSERT OR REPLACE INTO live_daily_log
            (id,nickname,date,tiktok_start,tiktok_end,fb_start,fb_end,
             sales_shopee,sales_tiktok,sales_outside_tiktok,sales_outside_fb,
             obstacles,suggestions,note,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        generateId(), nickname.trim(), date,
        dl.tiktok_start || '', dl.tiktok_end || '',
        dl.fb_start || '', dl.fb_end || '',
        dl.sales_shopee || 0, dl.sales_tiktok || 0,
        dl.sales_outside_tiktok || 0, dl.sales_outside_fb || 0,
        dl.obstacles || '', dl.suggestions || '', dl.note || '',
        now,
      ],
    })
  }

  for (const s of sales) {
    await db.execute({
      sql: 'INSERT INTO live_sales_report (id,nickname,date,product_name,qty_box,qty_pack,amount,platform,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [generateId(), nickname.trim(), date, s.product_name || '', s.qty_box || 0, s.qty_pack || 0, s.amount || 0, s.platform || '', s.note || '', now],
    })
  }

  for (const g of gifts) {
    await db.execute({
      sql: 'INSERT INTO live_gifts (id,nickname,date,gift_name,promo_type,qty,unit,price,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [generateId(), nickname.trim(), date, g.gift_name || '', g.promo_type || '', g.qty || 1, g.unit || '', g.price || 0, g.note || '', now],
    })
  }

  return NextResponse.json({ ok: true, inserted: { sales: sales.length, gifts: gifts.length, daily_log: !!daily_log } })
}
