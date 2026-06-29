'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

const POLL_INTERVAL = 5000

interface Tournament {
  id: string
  name: string
  status: string
  current_round: number
  total_rounds: number
  host: string
}

interface SwissPlayer {
  id: string
  nickname: string
  points: number
  wins: number
  losses: number
  draws: number
  received_bye: number
}

interface SwissMatch {
  id: string
  round: number
  player1: string
  player2: string | null
  status: string
  reported_winner: string | null
  reported_by: string | null
  winner: string | null
}

export default function SwissTournamentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<SwissPlayer[]>([])
  const [matches, setMatches] = useState<SwissMatch[]>([])
  const [nickname, setNickname] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [resultModal, setResultModal] = useState<string | null>(null)
  const [confirmResult, setConfirmResult] = useState<'win' | 'lose' | 'draw' | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('swiss_nickname')
    if (saved) { setNickname(saved); setNicknameInput(saved) }
  }, [])

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), 4000)
  }
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/swiss/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setTournament(data.tournament)
      setPlayers(data.players)
      setMatches(data.matches)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  const saveNickname = () => {
    const n = nicknameInput.trim()
    if (!n) return
    setNickname(n)
    localStorage.setItem('swiss_nickname', n)
  }

  const patch = async (body: object) => {
    const res = await fetch(`/api/swiss/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
    return data
  }

  const register = async () => {
    if (!nickname) { showError('กรุณากรอกชื่อก่อน'); return }
    setSubmitting(true)
    try {
      await patch({ action: 'register', nickname })
      showSuccess('สมัครเข้าร่วมแล้ว!')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const unregister = async () => {
    if (!nickname) return
    setSubmitting(true)
    try {
      await patch({ action: 'unregister', nickname })
      showSuccess('ยกเลิกการสมัครแล้ว')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const startTournament = async () => {
    setSubmitting(true)
    try {
      await patch({ action: 'start', host: nickname })
      showSuccess('เริ่มทัวร์นาเมนต์แล้ว!')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const nextRound = async () => {
    setSubmitting(true)
    try {
      const data = await patch({ action: 'next_round', host: nickname })
      showSuccess(data.completed ? 'ทัวร์นาเมนต์จบแล้ว!' : 'เปิดรอบถัดไปแล้ว!')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const submitResult = async (matchId: string) => {
    if (!confirmResult || !nickname) return
    const match = matches.find((m) => m.id === matchId)
    if (!match) return
    const opponent = match.player1 === nickname ? match.player2 : match.player1
    const winner = confirmResult === 'draw' ? 'draw' : confirmResult === 'win' ? nickname : (opponent ?? nickname)
    setSubmitting(true)
    try {
      await patch({ action: 'report', match_id: matchId, winner, reporter: nickname })
      setResultModal(null)
      setConfirmResult(null)
      showSuccess('ส่งผลแล้ว รอฝ่ายตรงข้ามยืนยัน...')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const confirmResultFn = async (matchId: string) => {
    setSubmitting(true)
    try {
      await patch({ action: 'confirm_result', match_id: matchId, confirmer: nickname })
      showSuccess('ยืนยันผลแล้ว!')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const rejectResultFn = async (matchId: string) => {
    setSubmitting(true)
    try {
      await patch({ action: 'reject_result', match_id: matchId })
      showSuccess('ปฏิเสธผลแล้ว — รายงานผลใหม่ได้เลย')
      await fetchData()
    } catch (e) { showError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const isRegistered = players.some((p) => p.nickname === nickname)
  const isHost = tournament?.host === nickname
  const allMatchesCompleted = matches.length > 0 && matches.every((m) => m.status === 'completed')
  const myMatch = matches.find((m) => m.player1 === nickname || m.player2 === nickname)

  const winnerLabel = (m: SwissMatch) => {
    if (!m.winner) return null
    if (m.winner === 'draw') return 'เสมอ'
    if (m.winner === 'bye') return 'BYE'
    return `${m.winner} ชนะ`
  }

  const rankBg = (i: number) =>
    i === 0 ? 'bg-yellow-400 text-white'
    : i === 1 ? 'bg-gray-300 text-gray-700'
    : i === 2 ? 'bg-amber-600 text-white'
    : 'bg-gray-100 text-gray-500'

  if (loading) return (
    <main className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
      <p className="text-gray-400 text-sm">กำลังโหลด...</p>
    </main>
  )

  if (!tournament) return (
    <main className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
      <p className="text-gray-400 text-sm">ไม่พบทัวร์นาเมนต์</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#F5F6F8] pb-8">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 pt-10 pb-6">
        <button onClick={() => router.push('/swiss')} className="text-xs opacity-60 mb-2 block">← กลับ</button>
        <h1 className="text-xl font-bold">{tournament.name}</h1>
        <p className="text-xs opacity-70 mt-1">
          {tournament.status === 'registration' && '📋 กำลังรับสมัคร'}
          {tournament.status === 'active' && `⚔️ รอบ ${tournament.current_round} / ${tournament.total_rounds}`}
          {tournament.status === 'completed' && '✅ ทัวร์นาเมนต์จบแล้ว'}
          {' — Host: '}{tournament.host}
        </p>
      </div>

      {/* Toast */}
      {error && <div className="mx-4 mt-3 bg-[#DC2626] text-white text-sm rounded-xl px-4 py-3">{error}</div>}
      {successMsg && <div className="mx-4 mt-3 bg-[#16A34A] text-white text-sm rounded-xl px-4 py-3">{successMsg}</div>}

      <div className="px-4 mt-4 space-y-4">
        {/* Nickname */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#374151] mb-2">ชื่อผู้เล่น</p>
          <div className="flex gap-2">
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNickname() }}
              placeholder="กรอกชื่อเล่น"
              className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
            <button onClick={saveNickname} className="px-4 py-2.5 bg-[#1E3A5F] text-white text-sm font-semibold rounded-xl">
              ยืนยัน
            </button>
          </div>
          {nickname && (
            <p className="text-xs text-[#16A34A] mt-2 font-medium">
              ผู้เล่น: {nickname} {isHost && '👑 Host'}
            </p>
          )}
        </div>

        {/* ===== REGISTRATION PHASE ===== */}
        {tournament.status === 'registration' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-[#1E3A5F] mb-3">ผู้เล่น ({players.length} คน)</p>
              {players.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีผู้สมัคร</p>
              ) : (
                <div className="space-y-1.5">
                  {players.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                      <span className="text-sm text-[#374151]">{p.nickname}</span>
                      {tournament.host === p.nickname && <span className="text-[10px] text-[#1E3A5F]">👑</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {nickname && (
              <div className="flex gap-2">
                {!isRegistered ? (
                  <button
                    onClick={register}
                    disabled={submitting}
                    className="flex-1 py-3.5 bg-[#16A34A] text-white font-bold rounded-2xl text-sm disabled:opacity-50"
                  >
                    ✅ สมัครเข้าร่วม
                  </button>
                ) : (
                  <button
                    onClick={unregister}
                    disabled={submitting}
                    className="flex-1 py-3.5 border border-[#DC2626] text-[#DC2626] font-bold rounded-2xl text-sm disabled:opacity-50"
                  >
                    ยกเลิกการสมัคร
                  </button>
                )}
                {isHost && players.length >= 2 && (
                  <button
                    onClick={startTournament}
                    disabled={submitting}
                    className="flex-1 py-3.5 bg-[#1E3A5F] text-white font-bold rounded-2xl text-sm disabled:opacity-50"
                  >
                    ⚔️ เริ่มเลย
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== ACTIVE PHASE ===== */}
        {tournament.status === 'active' && (
          <>
            {/* My Match */}
            {myMatch && (
              <div className={`rounded-2xl p-4 border-2 shadow-sm ${
                myMatch.status === 'completed'
                  ? 'bg-[#16A34A]/5 border-[#16A34A]/30'
                  : 'bg-[#1E3A5F]/5 border-[#1E3A5F]'
              }`}>
                <p className="text-xs font-semibold text-[#374151] mb-1">แมตช์ของคุณ — รอบ {tournament.current_round}</p>
                <p className="text-base font-bold text-[#374151] mt-1">
                  <span className={myMatch.player1 === nickname ? 'text-[#1E3A5F]' : ''}>{myMatch.player1}</span>
                  <span className="text-gray-400 text-sm font-normal mx-2">vs</span>
                  <span className={myMatch.player2 === nickname ? 'text-[#1E3A5F]' : ''}>{myMatch.player2 ?? 'BYE'}</span>
                </p>

                {myMatch.status === 'completed' && (
                  <p className="text-sm text-[#16A34A] font-semibold mt-2">
                    ✅ {winnerLabel(myMatch)}
                  </p>
                )}

                {myMatch.status === 'pending' && myMatch.player2 !== null && (
                  <button
                    onClick={() => setResultModal(myMatch.id)}
                    className="mt-3 w-full py-2.5 bg-[#1E3A5F] text-white text-sm font-bold rounded-xl"
                  >
                    บันทึกผล
                  </button>
                )}

                {myMatch.status === 'reported' && myMatch.reported_by === nickname && (
                  <div className="mt-3 py-2.5 bg-amber-100 text-amber-700 text-sm font-semibold rounded-xl text-center">
                    ⏳ รอฝ่ายตรงข้ามยืนยัน...
                  </div>
                )}

                {myMatch.status === 'reported' && myMatch.reported_by !== nickname && (
                  <div className="mt-3 bg-amber-50 border border-amber-400 rounded-xl p-3">
                    <p className="text-xs text-amber-800 font-semibold mb-2">
                      {myMatch.reported_by} รายงานผล:{' '}
                      {myMatch.reported_winner === 'draw' ? 'เสมอ'
                        : myMatch.reported_winner === nickname ? '🏆 คุณชนะ'
                        : '❌ คุณแพ้'}{' '}
                      — ถูกต้องหรือไม่?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmResultFn(myMatch.id)}
                        disabled={submitting}
                        className="flex-1 py-2 bg-[#16A34A] text-white text-sm font-bold rounded-xl disabled:opacity-50"
                      >
                        ✅ ถูกต้อง
                      </button>
                      <button
                        onClick={() => rejectResultFn(myMatch.id)}
                        disabled={submitting}
                        className="flex-1 py-2 bg-[#DC2626] text-white text-sm font-bold rounded-xl disabled:opacity-50"
                      >
                        ❌ ไม่ถูกต้อง
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All Pairings */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0]">
                <p className="text-sm font-bold text-[#1E3A5F]">คู่แข่งรอบ {tournament.current_round}</p>
              </div>
              {matches.map((m, i) => (
                <div key={m.id} className={`flex items-center gap-2 px-4 py-3 ${i > 0 ? 'border-t border-[#E2E8F0]' : ''}`}>
                  <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#374151] truncate">
                      <span className={m.player1 === nickname ? 'font-bold text-[#1E3A5F]' : ''}>{m.player1}</span>
                      <span className="text-gray-400 mx-1 text-xs">vs</span>
                      <span className={m.player2 === nickname ? 'font-bold text-[#1E3A5F]' : ''}>{m.player2 ?? 'BYE'}</span>
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    m.status === 'completed' ? 'bg-[#16A34A]/10 text-[#16A34A]'
                    : m.status === 'reported' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {m.status === 'completed' ? (winnerLabel(m) ?? '✅')
                    : m.status === 'reported' ? 'รอยืนยัน'
                    : 'รอผล'}
                  </span>
                </div>
              ))}
            </div>

            {/* Host: Next Round */}
            {isHost && allMatchesCompleted && (
              <button
                onClick={nextRound}
                disabled={submitting}
                className="w-full py-3.5 bg-[#1E3A5F] text-white font-bold rounded-2xl text-sm disabled:opacity-50"
              >
                {Number(tournament.current_round) >= Number(tournament.total_rounds)
                  ? '🏁 จบทัวร์นาเมนต์'
                  : `⚔️ เปิดรอบ ${Number(tournament.current_round) + 1}`}
              </button>
            )}

            {/* Standings */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0]">
                <p className="text-sm font-bold text-[#1E3A5F]">🏆 ตารางคะแนน</p>
              </div>
              {players.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#E2E8F0]' : ''}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankBg(i)}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${p.nickname === nickname ? 'text-[#1E3A5F]' : 'text-[#374151]'}`}>
                      {p.nickname}
                    </p>
                    <p className="text-[11px] text-gray-400">{p.wins}W {p.losses}L {p.draws}D</p>
                  </div>
                  <span className="text-base font-bold text-[#1E3A5F] shrink-0">{p.points} pts</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== COMPLETED PHASE ===== */}
        {tournament.status === 'completed' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#16A34A]/5">
              <p className="text-sm font-bold text-[#16A34A]">🏁 ผลสุดท้าย</p>
            </div>
            {players.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#E2E8F0]' : ''}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankBg(i)}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#374151] truncate">{p.nickname}</p>
                  <p className="text-[11px] text-gray-400">{p.wins}W {p.losses}L {p.draws}D</p>
                </div>
                <span className="text-base font-bold text-[#1E3A5F] shrink-0">{p.points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#1E3A5F] text-center mb-5">บันทึกผลการแข่งขัน</h2>
            {!confirmResult ? (
              <div className="space-y-3">
                <button onClick={() => setConfirmResult('win')} className="w-full py-4 bg-[#16A34A] text-white font-bold rounded-2xl text-base">🏆 ชนะ</button>
                <button onClick={() => setConfirmResult('lose')} className="w-full py-4 bg-[#DC2626] text-white font-bold rounded-2xl text-base">❌ แพ้</button>
                <button onClick={() => setConfirmResult('draw')} className="w-full py-4 border-2 border-gray-300 text-gray-600 font-bold rounded-2xl text-base">🤝 เสมอ</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#F5F6F8] rounded-2xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">คุณเลือก</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {confirmResult === 'win' ? '🏆 ชนะ' : confirmResult === 'lose' ? '❌ แพ้' : '🤝 เสมอ'}
                  </p>
                </div>
                <button
                  onClick={() => submitResult(resultModal)}
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#1E3A5F] text-white font-bold rounded-2xl disabled:opacity-50"
                >
                  {submitting ? 'กำลังส่ง...' : 'ยืนยัน'}
                </button>
                <button onClick={() => setConfirmResult(null)} className="w-full py-3 text-gray-400 text-sm">เปลี่ยนผล</button>
              </div>
            )}
            <button
              onClick={() => { setResultModal(null); setConfirmResult(null) }}
              className="w-full py-3 text-gray-400 text-sm mt-1"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
