import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema, generateId } from '@/lib/db'

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const game_id = searchParams.get('game_id')
  const month = searchParams.get('month')
  if (!game_id || !month) {
    return NextResponse.json({ error: 'กรุณาระบุ game_id และ month' }, { status: 400 })
  }
  const result = await db.execute({
    sql: `SELECT tier, reward_text, image_url FROM tcg_game_rewards WHERE game_id = ? AND month = ? ORDER BY tier`,
    args: [game_id, month],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const body = await req.json()
  const { game_id, month, tier, reward_text, image_url } = body
  if (!game_id || !month || !tier) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const validTiers = ['E', 'D', 'C', 'B', 'A', 'S', 'Special']
  if (!validTiers.includes(tier)) {
    return NextResponse.json({ error: 'tier ไม่ถูกต้อง' }, { status: 400 })
  }
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO tcg_game_rewards (id, game_id, month, tier, reward_text, image_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(game_id, month, tier) DO UPDATE SET reward_text = excluded.reward_text, image_url = excluded.image_url, updated_at = excluded.updated_at`,
    args: [generateId(), game_id, month, tier, reward_text || '', image_url || '', now],
  })
  return NextResponse.json({ ok: true })
}
