'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const BRANCH = 'gap7card'

interface Tournament {
  id: string
  name: string
  status: string
  current_round: number
  total_rounds: number
  host: string
  created_at: string
}

export default function SwissPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [tournamentName, setTournamentName] = useState('')
  const [hostName, setHostName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('swiss_nickname')
    if (saved) setHostName(saved)
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const res = await fetch(`/api/swiss?branch=${BRANCH}`)
      const data = await res.json()
      setTournaments(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const createTournament = async () => {
    if (!tournamentName.trim() || !hostName.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/swiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: BRANCH, name: tournamentName.trim(), host: hostName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      localStorage.setItem('swiss_nickname', hostName.trim())
      window.location.href = `/swiss/${data.id}`
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] pb-8">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 pt-10 pb-6">
        <Link href="/" className="text-xs opacity-60 mb-3 block">← กลับหน้าหลัก</Link>
        <h1 className="text-xl font-bold">🏆 Swiss Round</h1>
        <p className="text-xs opacity-70 mt-1">ทัวร์นาเมนต์แบบสากล — {BRANCH}</p>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-[#DC2626] text-white text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="px-4 mt-4 space-y-3">
        <button
          onClick={() => { setCreateModal(true); setError('') }}
          className="w-full py-3.5 bg-[#1E3A5F] text-white font-bold rounded-2xl text-sm"
        >
          + สร้างทัวร์นาเมนต์ใหม่
        </button>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">กำลังโหลด...</p>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">🏆</p>
            <p className="text-gray-400 text-sm">ยังไม่มีทัวร์นาเมนต์วันนี้</p>
            <p className="text-gray-300 text-xs mt-1">กดสร้างทัวร์นาเมนต์ใหม่ด้านบน</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/swiss/${t.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1E3A5F] truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Host: {t.host}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    t.status === 'registration'
                      ? 'bg-[#16A34A]/10 text-[#16A34A]'
                      : 'bg-[#1E3A5F]/10 text-[#1E3A5F]'
                  }`}>
                    {t.status === 'registration'
                      ? '📋 รับสมัคร'
                      : `⚔️ รอบ ${t.current_round}/${t.total_rounds}`}
                  </span>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#1E3A5F] mb-4">สร้างทัวร์นาเมนต์</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">ชื่อทัวร์นาเมนต์</label>
                <input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="เช่น GAP Swiss Cup #1"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">ชื่อของคุณ (Host)</label>
                <input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="ชื่อเล่น"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              {error && <p className="text-xs text-[#DC2626]">{error}</p>}
              <button
                onClick={createTournament}
                disabled={submitting}
                className="w-full py-3.5 bg-[#1E3A5F] text-white font-bold rounded-2xl text-sm disabled:opacity-50"
              >
                {submitting ? 'กำลังสร้าง...' : 'สร้างทัวร์นาเมนต์'}
              </button>
              <button
                onClick={() => { setCreateModal(false); setError('') }}
                className="w-full py-2 text-gray-400 text-sm"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
