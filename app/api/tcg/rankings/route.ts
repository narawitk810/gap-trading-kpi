import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch') || 'gap7card'
  const game = searchParams.get('game') || 'general'
  const nickname = searchParams.get('nickname')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  await ensureSchema()
  const db = getDb()

  if (nickname) {
    const result = await db.execute({
      sql: `SELECT * FROM tcg_rankings WHERE branch = ? AND game = ? AND nickname = ? LIMIT 1`,
      args: [branch, game, nickname],
    })
    return NextResponse.json(result.rows[0] || null)
  }

  const result = await db.execute({
    sql: `SELECT * FROM tcg_rankings WHERE branch = ? AND game = ? ORDER BY points DESC, wins DESC LIMIT ?`,
    args: [branch, game, limit],
  })
  return NextResponse.json(result.rows)
}
