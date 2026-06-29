'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import QRCode from 'react-qr-code'

const BRANCH = 'gap7card'
const TOTAL_TABLES = 9
const POLL_INTERVAL = 5000

interface TcgSession {
  id: string
  branch: string
  table_number: number
  match_type: string
  player1: string
  player2: string | null
  status: string
  winner: string | null
  created_at: string
  started_at: string | null
  ended_at: string | null
}

interface TcgRanking {
  id: string
  branch: string
  nickname: string
  wins: number
  losses: number
  draws: number
  points: number
  updated_at: string
}

type TableStatus = 'empty' | 'waiting' | 'playing'

interface TableInfo {
  tableNumber: number
  status: TableStatus
  session: TcgSession | null
}

export default function TcgPage() {
  const [tab, setTab] = useState<'tables' | 'rankings'>('tables')
  const [nickname, setNickname] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [matchType, setMatchType] = useState<'friendly' | 'ranking'>('friendly')
  const [sessions, setSessions] = useState<TcgSession[]>([])
  const [mySessionId, setMySessionId] = useState<string | null>(null)
  const [mySession, setMySession] = useState<TcgSession | null>(null)
  const [rankings, setRankings] = useState<TcgRanking[]>([])
  const [rankSearch, setRankSearch] = useState('')
  const [myRanking, setMyRanking] = useState<TcgRanking | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resultModal, setResultModal] = useState(false)
  const [confirmResult, setConfirmResult] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [qrModal, setQrModal] = useState(false)
  const [pageUrl, setPageUrl] = useState('')
  const [muted, setMuted] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const lobbyAudio = useRef<HTMLAudioElement | null>(null)
  const battleAudio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setPageUrl(window.location.origin + '/tcg')
  }, [])

  // init audio objects
  useEffect(() => {
    const lobby = new Audio('/music/lobby.mp3')
    lobby.loop = true
    lobby.volume = 0.4
    const battle = new Audio('/music/battle.mp3')
    battle.loop = true
    battle.volume = 0.5
    lobbyAudio.current = lobby
    battleAudio.current = battle
    const savedMute = localStorage.getItem('tcg_muted') === 'true'
    setMuted(savedMute)
    return () => { lobby.pause(); battle.pause() }
  }, [])

  // switch เพลงตาม session status
  useEffect(() => {
    if (!audioReady || muted) return
    const isPlaying = mySession?.status === 'playing'
    if (isPlaying) {
      lobbyAudio.current?.pause()
      if (battleAudio.current) {
        battleAudio.current.currentTime = 0
        battleAudio.current.play().catch(() => {})
      }
    } else {
      battleAudio.current?.pause()
      lobbyAudio.current?.play().catch(() => {})
    }
  }, [mySession?.status, audioReady, muted])

  const handleFirstInteract = () => {
    if (audioReady || muted) return
    setAudioReady(true)
    lobbyAudio.current?.play().catch(() => {})
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    localStorage.setItem('tcg_muted', String(next))
    if (next) {
      lobbyAudio.current?.pause()
      battleAudio.current?.pause()
    } else {
      setAudioReady(true)
      const isPlaying = mySession?.status === 'playing'
      if (isPlaying) battleAudio.current?.play().catch(() => {})
      else lobbyAudio.current?.play().catch(() => {})
    }
  }

  // โหลด nickname + sessionId จาก localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tcg_nickname')
    if (saved) { setNickname(saved); setNicknameInput(saved) }
    const sid = localStorage.getItem('tcg_session_id')
    if (sid) setMySessionId(sid)
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/tcg?branch=${BRANCH}`)
      const data: TcgSession[] = await res.json()
      setSessions(data)

      // หา mySession จาก list
      if (mySessionId) {
        const found = data.find((s) => s.id === mySessionId)
        if (found) {
          setMySession(found)
        } else {
          // session หายไป (completed/cancelled) → clear
          const checkRes = await fetch(`/api/tcg?branch=${BRANCH}`)
          void checkRes
          setMySession(null)
          setMySessionId(null)
          localStorage.removeItem('tcg_session_id')
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [mySessionId])

  const fetchRankings = useCallback(async () => {
    try {
      const res = await fetch(`/api/tcg/rankings?branch=${BRANCH}&limit=20`)
      const data: TcgRanking[] = await res.json()
      setRankings(data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchSessions])

  useEffect(() => {
    if (tab === 'rankings') fetchRankings()
  }, [tab, fetchRankings])

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), 4000)
  }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const saveNickname = () => {
    const n = nicknameInput.trim()
    if (!n) return
    setNickname(n)
    localStorage.setItem('tcg_nickname', n)
  }

  const buildTables = (): TableInfo[] => {
    return Array.from({ length: TOTAL_TABLES }, (_, i) => {
      const tableNum = i + 1
      const session = sessions.find((s) => s.table_number === tableNum) || null
      let status: TableStatus = 'empty'
      if (session?.status === 'waiting') status = 'waiting'
      else if (session?.status === 'playing') status = 'playing'
      return { tableNumber: tableNum, status, session }
    })
  }

  const createSession = async (tableNumber: number) => {
    if (!nickname) { showError('กรุณากรอกชื่อก่อน'); return }
    if (mySessionId) { showError('คุณมีโต๊ะอยู่แล้ว กรุณายกเลิกก่อน'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tcg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: BRANCH, table_number: tableNumber, match_type: matchType, player1: nickname }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error || 'เกิดข้อผิดพลาด'); return }
      setMySessionId(data.id)
      localStorage.setItem('tcg_session_id', data.id)
      showSuccess(`สร้างโต๊ะ ${tableNumber} แล้ว รอคู่แข่ง...`)
      await fetchSessions()
    } catch {
      showError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  const joinSession = async (sessionId: string) => {
    if (!nickname) { showError('กรุณากรอกชื่อก่อน'); return }
    if (mySessionId) { showError('คุณมีโต๊ะอยู่แล้ว กรุณายกเลิกก่อน'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tcg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, action: 'join', player2: nickname }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error || 'เกิดข้อผิดพลาด'); return }
      setMySessionId(sessionId)
      localStorage.setItem('tcg_session_id', sessionId)
      showSuccess('เข้าร่วมแมตช์แล้ว!')
      await fetchSessions()
    } catch {
      showError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  const randomTable = async () => {
    const tables = buildTables()
    const empty = tables.filter((t) => t.status === 'empty')
    if (empty.length === 0) { showError('ไม่มีโต๊ะว่าง'); return }
    const pick = empty[Math.floor(Math.random() * empty.length)]
    await createSession(pick.tableNumber)
  }

  const autoMatch = async () => {
    if (!nickname) { showError('กรุณากรอกชื่อก่อน'); return }
    if (mySessionId) { showError('คุณมีโต๊ะอยู่แล้ว กรุณายกเลิกก่อน'); return }
    // หาโต๊ะ waiting ที่ match_type ตรง และไม่ใช่ตัวเอง
    const waiting = sessions.find(
      (s) => s.status === 'waiting' && s.match_type === matchType && s.player1 !== nickname
    )
    if (waiting) {
      await joinSession(waiting.id)
    } else {
      await randomTable()
    }
  }

  const cancelSession = async () => {
    if (!mySessionId) return
    setSubmitting(true)
    try {
      await fetch('/api/tcg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mySessionId, action: 'cancel' }),
      })
      setMySessionId(null)
      setMySession(null)
      localStorage.removeItem('tcg_session_id')
      showSuccess('ยกเลิกโต๊ะแล้ว')
      await fetchSessions()
    } catch {
      showError('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const submitResult = async () => {
    if (!mySessionId || !mySession || !confirmResult) return
    if (!nickname) return
    const opponent = mySession.player1 === nickname ? mySession.player2 : mySession.player1
    let winner: string
    if (confirmResult === 'draw') winner = 'draw'
    else if (confirmResult === 'win') winner = nickname
    else winner = opponent || nickname

    setSubmitting(true)
    try {
      const res = await fetch('/api/tcg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mySessionId, action: 'result', winner, reporter: nickname }),
      })
      if (!res.ok) { showError('เกิดข้อผิดพลาด'); return }
      setMySessionId(null)
      setMySession(null)
      setResultModal(false)
      setConfirmResult(null)
      localStorage.removeItem('tcg_session_id')
      showSuccess('บันทึกผลแล้ว!')
      await fetchSessions()
      if (mySession.match_type === 'ranking') await fetchRankings()
    } catch {
      showError('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const searchMyRank = async () => {
    if (!rankSearch.trim()) return
    try {
      const res = await fetch(`/api/tcg/rankings?branch=${BRANCH}&nickname=${encodeURIComponent(rankSearch.trim())}`)
      const data = await res.json()
      setMyRanking(data)
    } catch {
      setMyRanking(null)
    }
  }

  const tables = buildTables()
  const myTable = mySession ? tables.find((t) => t.tableNumber === mySession.table_number) : null
  const opponent = mySession
    ? mySession.player1 === nickname
      ? mySession.player2
      : mySession.player1
    : null

  const tableColor = (status: TableStatus) => {
    if (status === 'empty') return 'bg-[#16A34A]/10 border-[#16A34A]/30 hover:bg-[#16A34A]/20'
    if (status === 'waiting') return 'bg-amber-50 border-amber-300 hover:bg-amber-100'
    return 'bg-[#DC2626]/10 border-[#DC2626]/30 cursor-default'
  }

  const tableIcon = (status: TableStatus) => {
    if (status === 'empty') return '🟢'
    if (status === 'waiting') return '🟡'
    return '🔴'
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] pb-8" onClick={handleFirstInteract}>
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs opacity-60 mb-1">{BRANCH}</p>
            <h1 className="text-xl font-bold">♟ Match Making TCG</h1>
            <p className="text-xs opacity-70 mt-1">จับคู่เกมการ์ด — {TOTAL_TABLES} โต๊ะ</p>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute() }}
              className="px-3 py-1.5 bg-white/15 rounded-xl text-xs font-semibold hover:bg-white/25 transition-colors"
              title={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={() => setQrModal(true)}
              className="px-3 py-1.5 bg-white/15 rounded-xl text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              📱 QR Code
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {error && (
        <div className="mx-4 mt-3 bg-[#DC2626] text-white text-sm rounded-xl px-4 py-3 font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mx-4 mt-3 bg-[#16A34A] text-white text-sm rounded-xl px-4 py-3 font-medium">
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-4 bg-white rounded-2xl p-1 shadow-sm">
        {(['tables', 'rankings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? 'bg-[#1E3A5F] text-white' : 'text-gray-500 hover:text-[#1E3A5F]'
            }`}
          >
            {t === 'tables' ? '🎮 โต๊ะ' : '🏆 อันดับ'}
          </button>
        ))}
      </div>

      {tab === 'tables' && (
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
              <button
                onClick={saveNickname}
                className="px-4 py-2.5 bg-[#1E3A5F] text-white text-sm font-semibold rounded-xl"
              >
                ยืนยัน
              </button>
            </div>
            {nickname && (
              <p className="text-xs text-[#16A34A] mt-2 font-medium">ผู้เล่น: {nickname}</p>
            )}
          </div>

          {/* Match Type */}
          {!mySessionId && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-[#374151] mb-3">ประเภทการแข่ง</p>
              <div className="flex gap-2">
                {(['friendly', 'ranking'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMatchType(t)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      matchType === t
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'border-[#E2E8F0] text-gray-500 hover:border-[#1E3A5F]'
                    }`}
                  >
                    {t === 'friendly' ? '🤝 เพื่อน' : '🏆 Ranking'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* My active session */}
          {mySession && (
            <div className={`rounded-2xl p-4 shadow-sm border-2 ${
              mySession.status === 'playing'
                ? 'bg-[#1E3A5F]/5 border-[#1E3A5F]'
                : 'bg-amber-50 border-amber-400'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-[#1E3A5F]">
                  {mySession.status === 'playing' ? '⚔️ กำลังแข่งขัน!' : '⏳ รอคู่แข่ง...'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  mySession.match_type === 'ranking' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {mySession.match_type === 'ranking' ? '🏆 Ranking' : '🤝 เพื่อน'}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                โต๊ะ {mySession.table_number}
                {mySession.status === 'playing' && opponent && ` — vs ${opponent}`}
              </p>
              <div className="flex gap-2 mt-3">
                {mySession.status === 'playing' && (
                  <button
                    onClick={() => setResultModal(true)}
                    className="flex-1 py-2.5 bg-[#1E3A5F] text-white text-sm font-bold rounded-xl"
                  >
                    บันทึกผล
                  </button>
                )}
                <button
                  onClick={cancelSession}
                  disabled={submitting}
                  className="flex-1 py-2.5 border border-[#DC2626] text-[#DC2626] text-sm font-semibold rounded-xl hover:bg-[#DC2626]/5"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!mySessionId && (
            <div className="flex gap-2">
              <button
                onClick={randomTable}
                disabled={submitting || !nickname}
                className="flex-1 py-3 bg-[#1E3A5F] text-white text-sm font-bold rounded-2xl disabled:opacity-40"
              >
                🎲 สุ่มโต๊ะ
              </button>
              <button
                onClick={autoMatch}
                disabled={submitting || !nickname}
                className="flex-1 py-3 border-2 border-[#1E3A5F] text-[#1E3A5F] text-sm font-bold rounded-2xl disabled:opacity-40 hover:bg-[#1E3A5F]/5"
              >
                🤝 จับคู่อัตโนมัติ
              </button>
            </div>
          )}

          {/* Table grid */}
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-2">
              โต๊ะทั้งหมด {TOTAL_TABLES} โต๊ะ
              {!loading && <span className="text-gray-400 ml-2">อัปเดตทุก 5 วิ</span>}
            </p>
            {loading ? (
              <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {tables.map((t) => {
                  const isMyTable = mySession?.table_number === t.tableNumber
                  return (
                    <button
                      key={t.tableNumber}
                      disabled={
                        submitting ||
                        t.status === 'playing' ||
                        !!mySessionId ||
                        !nickname
                      }
                      onClick={() => {
                        if (t.status === 'empty') createSession(t.tableNumber)
                        else if (t.status === 'waiting' && t.session) joinSession(t.session.id)
                      }}
                      className={`relative border-2 rounded-2xl p-3 text-left transition-colors ${tableColor(t.status)} ${
                        isMyTable ? 'ring-2 ring-[#1E3A5F]' : ''
                      } disabled:cursor-not-allowed`}
                    >
                      <p className="text-base">{tableIcon(t.status)}</p>
                      <p className="text-xs font-bold text-gray-700 mt-1">โต๊ะ {t.tableNumber}</p>
                      {t.status === 'empty' && (
                        <p className="text-[10px] text-[#16A34A] font-medium mt-0.5">ว่าง</p>
                      )}
                      {t.status === 'waiting' && t.session && (
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5 truncate">
                          {t.session.player1}
                        </p>
                      )}
                      {t.status === 'playing' && t.session && (
                        <p className="text-[10px] text-[#DC2626] font-medium mt-0.5">กำลังแข่ง</p>
                      )}
                      {t.status === 'waiting' && t.session?.match_type === 'ranking' && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] bg-[#1E3A5F] text-white px-1 py-0.5 rounded-full">R</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-400 px-1">
            <span>🟢 ว่าง — กดเพื่อสร้างโต๊ะ</span>
            <span>🟡 รอคู่ — กดเพื่อเข้าร่วม</span>
            <span>🔴 กำลังแข่ง</span>
          </div>
        </div>
      )}

      {tab === 'rankings' && (
        <div className="px-4 mt-4 space-y-4">
          {/* Search */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#374151] mb-2">ค้นหาคะแนนตัวเอง</p>
            <div className="flex gap-2">
              <input
                value={rankSearch}
                onChange={(e) => setRankSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchMyRank() }}
                placeholder="กรอกชื่อ..."
                className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                onClick={searchMyRank}
                className="px-4 py-2.5 bg-[#1E3A5F] text-white text-sm font-semibold rounded-xl"
              >
                ค้นหา
              </button>
            </div>
            {myRanking !== undefined && myRanking !== null && (
              <div className="mt-3 p-3 bg-[#1E3A5F]/5 rounded-xl">
                <p className="text-sm font-bold text-[#1E3A5F]">{myRanking.nickname}</p>
                <p className="text-2xl font-bold text-[#1E3A5F] mt-1">{myRanking.points} <span className="text-sm font-normal text-gray-400">คะแนน</span></p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>ชนะ <strong className="text-[#16A34A]">{myRanking.wins}</strong></span>
                  <span>แพ้ <strong className="text-[#DC2626]">{myRanking.losses}</strong></span>
                  <span>เสมอ <strong className="text-gray-600">{myRanking.draws}</strong></span>
                </div>
              </div>
            )}
            {myRanking === null && rankSearch && (
              <p className="text-xs text-gray-400 mt-2">ไม่พบข้อมูลผู้เล่น "{rankSearch}"</p>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0]">
              <p className="text-sm font-bold text-[#1E3A5F]">🏆 อันดับ Ranking — {BRANCH}</p>
            </div>
            {rankings.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">ยังไม่มีข้อมูล Ranking</p>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {rankings.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-yellow-400 text-white' :
                      i === 1 ? 'bg-gray-300 text-gray-700' :
                      i === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1E3A5F] truncate">{r.nickname}</p>
                      <p className="text-[11px] text-gray-400">{r.wins}W {r.losses}L {r.draws}D</p>
                    </div>
                    <span className="text-base font-bold text-[#1E3A5F] shrink-0">{r.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-center text-gray-400">Ranking match เท่านั้นที่นับคะแนน</p>
        </div>
      )}

      {/* Result Modal */}
      {resultModal && mySession && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#1E3A5F] text-center mb-1">บันทึกผลการแข่งขัน</h2>
            <p className="text-xs text-center text-gray-400 mb-5">
              {nickname} vs {opponent}
              {mySession.match_type === 'ranking' && <span className="ml-2 text-[#1E3A5F] font-medium">🏆 Ranking</span>}
            </p>

            {!confirmResult ? (
              <div className="space-y-3">
                <button
                  onClick={() => setConfirmResult('win')}
                  className="w-full py-4 bg-[#16A34A] text-white font-bold rounded-2xl text-base"
                >
                  🏆 ชนะ
                </button>
                <button
                  onClick={() => setConfirmResult('lose')}
                  className="w-full py-4 bg-[#DC2626] text-white font-bold rounded-2xl text-base"
                >
                  ❌ แพ้
                </button>
                <button
                  onClick={() => setConfirmResult('draw')}
                  className="w-full py-4 border-2 border-gray-300 text-gray-600 font-bold rounded-2xl text-base"
                >
                  🤝 เสมอ
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#F5F6F8] rounded-2xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">คุณเลือก</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {confirmResult === 'win' ? '🏆 ชนะ' : confirmResult === 'lose' ? '❌ แพ้' : '🤝 เสมอ'}
                  </p>
                  {mySession.match_type === 'ranking' && (
                    <p className="text-xs text-gray-400 mt-2">
                      {confirmResult === 'win' ? '+30 คะแนน' : confirmResult === 'lose' ? '-20 คะแนน' : '+5 คะแนน'}
                    </p>
                  )}
                </div>
                <button
                  onClick={submitResult}
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#1E3A5F] text-white font-bold rounded-2xl disabled:opacity-50"
                >
                  {submitting ? 'กำลังบันทึก...' : 'ยืนยันผล'}
                </button>
                <button
                  onClick={() => setConfirmResult(null)}
                  className="w-full py-3 text-gray-400 text-sm"
                >
                  เปลี่ยนผล
                </button>
              </div>
            )}

            <button
              onClick={() => { setResultModal(false); setConfirmResult(null) }}
              className="w-full py-3 text-gray-400 text-sm mt-1"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl w-full max-w-xs p-6 text-center">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-1">QR Code — Match Making TCG</h2>
            <p className="text-xs text-gray-400 mb-5">{BRANCH}</p>
            <div className="flex justify-center bg-white p-4 rounded-2xl border border-[#E2E8F0]">
              {pageUrl && <QRCode value={pageUrl} size={200} />}
            </div>
            <p className="text-xs text-gray-400 mt-3 break-all">{pageUrl}</p>
            <button
              onClick={() => setQrModal(false)}
              className="mt-5 w-full py-3 bg-[#1E3A5F] text-white font-semibold rounded-2xl text-sm"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
