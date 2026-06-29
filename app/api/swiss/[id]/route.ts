import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

interface SwissPlayer {
  nickname: string
  points: number
  wins: number
  losses: number
  draws: number
  received_bye: number
}

interface SwissMatch {
  player1: string
  player2: string | null
  winner: string | null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generatePairings(
  players: SwissPlayer[],
  existingMatches: SwissMatch[],
  round: number
): { p1: string; p2: string | null }[] {
  let sorted = round === 1
    ? shuffle([...players])
    : [...players].sort((a, b) => b.points - a.points || b.wins - a.wins)

  const played = new Set<string>()
  for (const m of existingMatches) {
    if (m.player2) {
      played.add(`${m.player1}|${m.player2}`)
      played.add(`${m.player2}|${m.player1}`)
    }
  }

  // คนที่ได้ bye น้อยที่สุดและ points ต่ำสุด
  let byePlayer: string | null = null
  if (sorted.length % 2 === 1) {
    const byeCandidate =
      [...sorted].reverse().find((p) => p.received_bye === 0) ??
      sorted[sorted.length - 1]
    byePlayer = byeCandidate.nickname
    sorted = sorted.filter((p) => p.nickname !== byePlayer)
  }

  const pairs: { p1: string; p2: string | null }[] = []
  const used = new Set<string>()

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].nickname)) continue
    let paired = false
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].nickname)) continue
      const p1 = sorted[i].nickname
      const p2 = sorted[j].nickname
      // ไม่เคยเจอกัน หรือ forced (ไม่มีตัวเลือกอื่น)
      const neverMet = !played.has(`${p1}|${p2}`)
      const noOtherOption = sorted.slice(j + 1).every((p) => used.has(p.nickname) || played.has(`${p1}|${p.nickname}`))
      if (neverMet || noOtherOption) {
        pairs.push({ p1, p2 })
        used.add(p1)
        used.add(p2)
        paired = true
        break
      }
    }
    if (!paired && !used.has(sorted[i].nickname)) {
      // force pair กับคนถัดไปที่ยังไม่จับคู่
      for (let j = i + 1; j < sorted.length; j++) {
        if (!used.has(sorted[j].nickname)) {
          pairs.push({ p1: sorted[i].nickname, p2: sorted[j].nickname })
          used.add(sorted[i].nickname)
          used.add(sorted[j].nickname)
          break
        }
      }
    }
  }

  if (byePlayer) pairs.push({ p1: byePlayer, p2: null })
  return pairs
}

async function insertPairings(
  db: Awaited<ReturnType<typeof getDb>>,
  tournamentId: string,
  round: number,
  pairs: { p1: string; p2: string | null }[],
  now: string
) {
  for (const { p1, p2 } of pairs) {
    const matchId = generateId()
    if (p2 === null) {
      await db.execute({
        sql: `INSERT INTO swiss_matches (id, tournament_id, round, player1, player2, status, winner, created_at, ended_at) VALUES (?, ?, ?, ?, NULL, 'completed', 'bye', ?, ?)`,
        args: [matchId, tournamentId, round, p1, now, now],
      })
      await db.execute({
        sql: `UPDATE swiss_players SET points = points + 3, wins = wins + 1, received_bye = 1 WHERE tournament_id = ? AND nickname = ?`,
        args: [tournamentId, p1],
      })
    } else {
      await db.execute({
        sql: `INSERT INTO swiss_matches (id, tournament_id, round, player1, player2, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        args: [matchId, tournamentId, round, p1, p2, now],
      })
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await ensureSchema()
  const db = getDb()

  const tResult = await db.execute({ sql: `SELECT * FROM swiss_tournaments WHERE id = ?`, args: [id] })
  if (!tResult.rows.length) return NextResponse.json({ error: 'ไม่พบทัวร์นาเมนต์' }, { status: 404 })
  const tournament = tResult.rows[0]

  const pResult = await db.execute({
    sql: `SELECT * FROM swiss_players WHERE tournament_id = ? ORDER BY points DESC, wins DESC`,
    args: [id],
  })

  const mResult = await db.execute({
    sql: `SELECT * FROM swiss_matches WHERE tournament_id = ? AND round = ? ORDER BY created_at ASC`,
    args: [id, tournament.current_round],
  })

  return NextResponse.json({ tournament, players: pResult.rows, matches: mResult.rows })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await ensureSchema()
  const db = getDb()
  const body = await request.json()
  const { action } = body

  const tResult = await db.execute({ sql: `SELECT * FROM swiss_tournaments WHERE id = ?`, args: [id] })
  if (!tResult.rows.length) return NextResponse.json({ error: 'ไม่พบทัวร์นาเมนต์' }, { status: 404 })
  const tournament = tResult.rows[0]
  const now = new Date().toISOString()

  if (action === 'register') {
    const { nickname } = body
    if (!nickname?.trim()) return NextResponse.json({ error: 'กรุณาระบุชื่อ' }, { status: 400 })
    if (tournament.status !== 'registration') return NextResponse.json({ error: 'ปิดรับสมัครแล้ว' }, { status: 409 })
    await db.execute({
      sql: `INSERT OR IGNORE INTO swiss_players (id, tournament_id, nickname, points, wins, losses, draws, received_bye, registered_at) VALUES (?, ?, ?, 0, 0, 0, 0, 0, ?)`,
      args: [generateId(), id, nickname.trim(), now],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'unregister') {
    const { nickname } = body
    if (tournament.status !== 'registration') return NextResponse.json({ error: 'ทัวร์นาเมนต์เริ่มแล้ว' }, { status: 409 })
    await db.execute({
      sql: `DELETE FROM swiss_players WHERE tournament_id = ? AND nickname = ?`,
      args: [id, nickname],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'start') {
    const { host } = body
    if (tournament.host !== host) return NextResponse.json({ error: 'เฉพาะ Host เท่านั้น' }, { status: 403 })
    if (tournament.status !== 'registration') return NextResponse.json({ error: 'ทัวร์นาเมนต์เริ่มแล้ว' }, { status: 409 })

    const pResult = await db.execute({ sql: `SELECT * FROM swiss_players WHERE tournament_id = ?`, args: [id] })
    const players = pResult.rows as unknown as SwissPlayer[]
    if (players.length < 2) return NextResponse.json({ error: 'ต้องมีผู้เล่นอย่างน้อย 2 คน' }, { status: 400 })

    const totalRounds = Math.ceil(Math.log2(players.length))
    const pairs = generatePairings(players, [], 1)
    await insertPairings(db, id, 1, pairs, now)

    await db.execute({
      sql: `UPDATE swiss_tournaments SET status = 'active', current_round = 1, total_rounds = ?, started_at = ? WHERE id = ?`,
      args: [totalRounds, now, id],
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'next_round') {
    const { host } = body
    if (tournament.host !== host) return NextResponse.json({ error: 'เฉพาะ Host เท่านั้น' }, { status: 403 })
    if (tournament.status !== 'active') return NextResponse.json({ error: 'ทัวร์นาเมนต์ไม่ได้อยู่ในสถานะ active' }, { status: 409 })

    const mResult = await db.execute({
      sql: `SELECT * FROM swiss_matches WHERE tournament_id = ? AND round = ?`,
      args: [id, tournament.current_round],
    })
    const allDone = mResult.rows.every((m) => m.status === 'completed')
    if (!allDone) return NextResponse.json({ error: 'ยังมีแมตช์ที่ยังไม่จบในรอบนี้' }, { status: 409 })

    if (Number(tournament.current_round) >= Number(tournament.total_rounds)) {
      await db.execute({
        sql: `UPDATE swiss_tournaments SET status = 'completed', ended_at = ? WHERE id = ?`,
        args: [now, id],
      })
      return NextResponse.json({ ok: true, completed: true })
    }

    const nextRound = Number(tournament.current_round) + 1
    const pResult = await db.execute({
      sql: `SELECT * FROM swiss_players WHERE tournament_id = ? ORDER BY points DESC, wins DESC`,
      args: [id],
    })
    const allMatchesResult = await db.execute({
      sql: `SELECT * FROM swiss_matches WHERE tournament_id = ?`,
      args: [id],
    })
    const pairs = generatePairings(
      pResult.rows as unknown as SwissPlayer[],
      allMatchesResult.rows as unknown as SwissMatch[],
      nextRound
    )
    await insertPairings(db, id, nextRound, pairs, now)

    await db.execute({
      sql: `UPDATE swiss_tournaments SET current_round = ? WHERE id = ?`,
      args: [nextRound, id],
    })
    return NextResponse.json({ ok: true, completed: false })
  }

  // Match result actions
  if (action === 'report' || action === 'confirm_result' || action === 'reject_result') {
    const { match_id } = body
    if (!match_id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

    const mResult = await db.execute({ sql: `SELECT * FROM swiss_matches WHERE id = ?`, args: [match_id] })
    if (!mResult.rows.length) return NextResponse.json({ error: 'ไม่พบแมตช์' }, { status: 404 })
    const match = mResult.rows[0]

    if (action === 'report') {
      const { winner, reporter } = body
      if (!winner || !reporter) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
      if (match.status !== 'pending') return NextResponse.json({ error: 'แมตช์นี้ไม่รับรายงานผลแล้ว' }, { status: 409 })
      if (match.player1 !== reporter && match.player2 !== reporter) {
        return NextResponse.json({ error: 'คุณไม่ได้อยู่ในแมตช์นี้' }, { status: 403 })
      }
      if (match.reported_by) return NextResponse.json({ error: 'มีผลรอยืนยันอยู่แล้ว' }, { status: 409 })
      await db.execute({
        sql: `UPDATE swiss_matches SET reported_winner = ?, reported_by = ?, status = 'reported' WHERE id = ?`,
        args: [winner, reporter, match_id],
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'confirm_result') {
      const { confirmer } = body
      if (!confirmer) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
      if (match.status !== 'reported') return NextResponse.json({ error: 'ไม่มีผลรอยืนยัน' }, { status: 409 })
      if (match.reported_by === confirmer) {
        return NextResponse.json({ error: 'ไม่สามารถยืนยันผลตัวเองได้' }, { status: 403 })
      }

      const winner = match.reported_winner as string
      await db.execute({
        sql: `UPDATE swiss_matches SET winner = ?, status = 'completed', reported_winner = NULL, reported_by = NULL, ended_at = ? WHERE id = ?`,
        args: [winner, now, match_id],
      })

      const p1 = match.player1 as string
      const p2 = match.player2 as string
      if (winner === 'draw') {
        await db.execute({
          sql: `UPDATE swiss_players SET points = points + 1, draws = draws + 1 WHERE tournament_id = ? AND nickname = ?`,
          args: [id, p1],
        })
        await db.execute({
          sql: `UPDATE swiss_players SET points = points + 1, draws = draws + 1 WHERE tournament_id = ? AND nickname = ?`,
          args: [id, p2],
        })
      } else {
        const loser = winner === p1 ? p2 : p1
        await db.execute({
          sql: `UPDATE swiss_players SET points = points + 3, wins = wins + 1 WHERE tournament_id = ? AND nickname = ?`,
          args: [id, winner],
        })
        await db.execute({
          sql: `UPDATE swiss_players SET losses = losses + 1 WHERE tournament_id = ? AND nickname = ?`,
          args: [id, loser],
        })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject_result') {
      if (match.status !== 'reported') return NextResponse.json({ error: 'ไม่มีผลรอยืนยัน' }, { status: 409 })
      await db.execute({
        sql: `UPDATE swiss_matches SET reported_winner = NULL, reported_by = NULL, status = 'pending' WHERE id = ?`,
        args: [match_id],
      })
      return NextResponse.json({ ok: true })
    }
  }

  return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
}
