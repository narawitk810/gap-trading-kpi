import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const TABLES = 9

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch') || 'gap7card'
  await ensureSchema()
  const db = getDb()

  // ล้าง session ที่ค้างเกิน 4 ชั่วโมงอัตโนมัติ
  const now = new Date().toISOString()
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  await db.execute({
    sql: `UPDATE tcg_sessions SET status = 'cancelled', ended_at = ?
          WHERE branch = ? AND status IN ('waiting', 'playing') AND created_at < ?`,
    args: [now, branch, cutoff],
  })

  const result = await db.execute({
    sql: `SELECT * FROM tcg_sessions WHERE branch = ? AND status IN ('waiting', 'playing') ORDER BY table_number ASC`,
    args: [branch],
  })
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { branch = 'gap7card', table_number, match_type, player1 } = body
  if (!player1?.trim() || !match_type || !table_number) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (table_number < 1 || table_number > TABLES) {
    return NextResponse.json({ error: 'หมายเลขโต๊ะไม่ถูกต้อง' }, { status: 400 })
  }
  await ensureSchema()
  const db = getDb()

  // ตรวจว่าโต๊ะนั้นมี session อยู่แล้วหรือยัง
  const existing = await db.execute({
    sql: `SELECT * FROM tcg_sessions WHERE branch = ? AND table_number = ? AND status IN ('waiting', 'playing') LIMIT 1`,
    args: [branch, table_number],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'โต๊ะนี้มีผู้เล่นอยู่แล้ว' }, { status: 409 })
  }

  const id = generateId()
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO tcg_sessions (id, branch, table_number, match_type, player1, status, created_at) VALUES (?, ?, ?, ?, ?, 'waiting', ?)`,
    args: [id, branch, table_number, match_type, player1.trim(), now],
  })
  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, action } = body
  if (!id || !action) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  await ensureSchema()
  const db = getDb()

  const sessionResult = await db.execute({
    sql: `SELECT * FROM tcg_sessions WHERE id = ?`,
    args: [id],
  })
  if (sessionResult.rows.length === 0) {
    return NextResponse.json({ error: 'ไม่พบ session' }, { status: 404 })
  }
  const session = sessionResult.rows[0]
  const now = new Date().toISOString()

  if (action === 'join') {
    const { player2 } = body
    if (!player2?.trim()) return NextResponse.json({ error: 'กรุณาระบุชื่อผู้เล่น' }, { status: 400 })
    if (session.status !== 'waiting') return NextResponse.json({ error: 'โต๊ะนี้ไม่พร้อมรับผู้เล่น' }, { status: 409 })
    if (session.player1 === player2.trim()) return NextResponse.json({ error: 'ไม่สามารถเล่นกับตัวเองได้' }, { status: 400 })
    await db.execute({
      sql: `UPDATE tcg_sessions SET player2 = ?, status = 'playing', started_at = ? WHERE id = ?`,
      args: [player2.trim(), now, id],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'result') {
    const { winner, reporter } = body
    if (!winner) return NextResponse.json({ error: 'กรุณาระบุผล' }, { status: 400 })
    if (session.status !== 'playing') return NextResponse.json({ error: 'แมตช์ยังไม่เริ่ม' }, { status: 409 })

    await db.execute({
      sql: `UPDATE tcg_sessions SET winner = ?, status = 'completed', ended_at = ? WHERE id = ?`,
      args: [winner, now, id],
    })

    // อัปเดต ranking เฉพาะ ranking match
    if (session.match_type === 'ranking' && session.player1 && session.player2) {
      const player1 = session.player1 as string
      const player2 = session.player2 as string
      const branch = session.branch as string

      const ensureRank = async (nick: string) => {
        await db.execute({
          sql: `INSERT OR IGNORE INTO tcg_rankings (id, branch, nickname, wins, losses, draws, points, updated_at) VALUES (?, ?, ?, 0, 0, 0, 1000, ?)`,
          args: [generateId(), branch, nick, now],
        })
      }
      await ensureRank(player1)
      await ensureRank(player2)

      if (winner === 'draw') {
        await db.execute({
          sql: `UPDATE tcg_rankings SET draws = draws + 1, points = MAX(0, points + 5), updated_at = ? WHERE branch = ? AND nickname = ?`,
          args: [now, branch, player1],
        })
        await db.execute({
          sql: `UPDATE tcg_rankings SET draws = draws + 1, points = MAX(0, points + 5), updated_at = ? WHERE branch = ? AND nickname = ?`,
          args: [now, branch, player2],
        })
      } else {
        const loser = winner === player1 ? player2 : player1
        await db.execute({
          sql: `UPDATE tcg_rankings SET wins = wins + 1, points = points + 30, updated_at = ? WHERE branch = ? AND nickname = ?`,
          args: [now, branch, winner],
        })
        await db.execute({
          sql: `UPDATE tcg_rankings SET losses = losses + 1, points = MAX(0, points - 20), updated_at = ? WHERE branch = ? AND nickname = ?`,
          args: [now, branch, loser],
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel') {
    await db.execute({
      sql: `UPDATE tcg_sessions SET status = 'cancelled', ended_at = ? WHERE id = ?`,
      args: [now, id],
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
}
