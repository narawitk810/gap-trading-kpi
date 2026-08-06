'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

type Video = { id: string; title: string; youtube_id: string; description: string; created_at: string; completion_count: number }
type StatRow = { employee_name: string; completed_at: string }

const DEPARTMENTS = ['ไลฟ์สด', 'Creative', 'การตลาด', 'Sales Admin', 'สต๊อค&จัดซื้อ', 'แพค', 'บัญชี&การเงิน', 'ธุรการ', 'บุคคล', 'ผู้จัดการไลฟ์สด']
const LS_KEY = 'training_employee_name'

function formatThaiDate(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export default function TrainingPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [videos, setVideos] = useState<Video[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Name selector modal
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [dept, setDept] = useState('')
  const [staffList, setStaffList] = useState<{ name: string }[]>([])
  const [selectedName, setSelectedName] = useState('')

  // Player modal
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null)
  const playerRef = useRef<any>(null)
  const ytReady = useRef(false)

  // Admin: add video
  const [addForm, setAddForm] = useState({ title: '', youtube_url: '', description: '' })
  const [addPreviewId, setAddPreviewId] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addConfirm, setAddConfirm] = useState(false)

  // Admin: delete
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Admin: stats expand
  const [expandedStats, setExpandedStats] = useState<Record<string, StatRow[]>>({})
  const [loadingStats, setLoadingStats] = useState<string | null>(null)

  // ─── Fetch ───────────────────────────────────────────────────────────────
  const fetchVideos = useCallback(async () => {
    const res = await fetch('/api/hr/training/videos')
    setVideos(await res.json())
    setLoading(false)
  }, [])

  const fetchCompletions = useCallback(async (name: string) => {
    const res = await fetch(`/api/hr/training/completions?employee_name=${encodeURIComponent(name)}`)
    const ids: string[] = await res.json()
    setCompletedIds(new Set(ids))
  }, [])

  useEffect(() => {
    fetchVideos()
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      setEmployeeName(saved)
      fetchCompletions(saved)
    } else {
      setNameModalOpen(true)
    }
  }, [fetchVideos, fetchCompletions])

  // ─── Department → staff ──────────────────────────────────────────────────
  useEffect(() => {
    if (!dept) return
    fetch(`/api/live-staff?department=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((d) => setStaffList(d.staff ?? []))
  }, [dept])

  function confirmName() {
    if (!selectedName) return
    localStorage.setItem(LS_KEY, selectedName)
    setEmployeeName(selectedName)
    setNameModalOpen(false)
    fetchCompletions(selectedName)
  }

  function resetName() {
    localStorage.removeItem(LS_KEY)
    setEmployeeName(null)
    setSelectedName('')
    setDept('')
    setStaffList([])
    setCompletedIds(new Set())
    setNameModalOpen(true)
  }

  // ─── YouTube IFrame API ──────────────────────────────────────────────────
  function loadYTScript(onReady: () => void) {
    if (window.YT && window.YT.Player) {
      ytReady.current = true
      onReady()
      return
    }
    window.onYouTubeIframeAPIReady = () => {
      ytReady.current = true
      onReady()
    }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    }
  }

  useEffect(() => {
    if (!playingVideo) {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
      return
    }

    function createPlayer() {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
      playerRef.current = new window.YT.Player('yt-player-div', {
        videoId: playingVideo!.youtube_id,
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onStateChange: (event: any) => {
            if (event.data === 0) handleVideoEnded()
          },
        },
      })
    }

    loadYTScript(createPlayer)
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingVideo?.id])

  async function handleVideoEnded() {
    if (!employeeName || !playingVideo) return
    await fetch('/api/hr/training/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_name: employeeName, video_id: playingVideo.id }),
    })
    setCompletedIds((prev) => { const next = new Set(Array.from(prev)); next.add(playingVideo.id); return next })
    fetchVideos()
    setPlayingVideo(null)
  }

  // ─── Admin: add video ────────────────────────────────────────────────────
  function extractYoutubeId(url: string): string {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    if (m) return m[1]
    const t = url.trim()
    return t.length === 11 ? t : ''
  }

  useEffect(() => {
    setAddPreviewId(extractYoutubeId(addForm.youtube_url))
  }, [addForm.youtube_url])

  async function handleAddVideo() {
    setAddSaving(true)
    await fetch('/api/hr/training/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    setAddSaving(false)
    setAddConfirm(false)
    setAddForm({ title: '', youtube_url: '', description: '' })
    fetchVideos()
  }

  // ─── Admin: delete video ─────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/hr/training/videos?id=${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    fetchVideos()
  }

  // ─── Admin: stats ────────────────────────────────────────────────────────
  async function toggleStats(videoId: string) {
    if (expandedStats[videoId]) {
      setExpandedStats((p) => { const n = { ...p }; delete n[videoId]; return n })
      return
    }
    setLoadingStats(videoId)
    const res = await fetch(`/api/hr/training/stats?video_id=${videoId}`)
    const rows: StatRow[] = await res.json()
    setExpandedStats((p) => ({ ...p, [videoId]: rows }))
    setLoadingStats(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>

      {/* Header */}
      <header className="bg-[#1E3A5F] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/hr-system" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-lg shrink-0">←</Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-blue-200">{isAdmin ? 'โหมดจัดการ' : employeeName ? `สวัสดี ${employeeName}` : 'เลือกชื่อพนักงาน'}</p>
            <h1 className="text-base font-bold">ศูนย์อบรม</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isAdmin && employeeName && (
              <button onClick={resetName} className="text-[11px] text-blue-200 hover:text-white underline">เปลี่ยนชื่อ</button>
            )}
            <button
              onClick={() => setIsAdmin(!isAdmin)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium"
            >
              {isAdmin ? '👤 มุมมองพนักงาน' : '⚙️ จัดการ'}
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* ── EMPLOYEE VIEW ── */}
        {!isAdmin && (
          <>
            {loading ? (
              <div className="text-center py-16 text-[#374151]">กำลังโหลด...</div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🎓</p>
                <p className="font-semibold text-[#374151]">ยังไม่มีคลิปอบรม</p>
                <p className="text-sm text-gray-400 mt-1">HR จะเพิ่มคลิปเร็วๆ นี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {videos.map((v) => {
                  const done = completedIds.has(v.id)
                  return (
                    <div key={v.id} className={`bg-white rounded-xl border overflow-hidden ${done ? 'border-green-200' : 'border-[#E2E8F0]'}`}>
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-gray-100">
                        <img
                          src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                          alt={v.title}
                          className="w-full h-full object-cover"
                        />
                        {done && (
                          <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center">
                            <span className="text-white text-4xl">✅</span>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#1E3A5F] text-sm">{v.title}</p>
                            {v.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{v.description}</p>}
                          </div>
                          {done && (
                            <span className="shrink-0 text-[11px] font-semibold text-[#16A34A] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">ดูจบแล้ว</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (!employeeName) { setNameModalOpen(true); return }
                            setPlayingVideo(v)
                          }}
                          className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                            done
                              ? 'bg-green-50 text-[#16A34A] border border-green-200'
                              : 'bg-[#1E3A5F] text-white hover:bg-[#16325a]'
                          }`}
                        >
                          {done ? '✅ ดูอีกครั้ง' : '▶️ ดูเลย'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── ADMIN VIEW ── */}
        {isAdmin && (
          <>
            {/* Add form */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-3">
              <p className="font-bold text-[#1E3A5F]">➕ เพิ่มคลิปอบรมใหม่</p>
              <input
                type="text"
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="ชื่อคลิป เช่น ความปลอดภัยในการทำงาน"
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
              <input
                type="text"
                value={addForm.youtube_url}
                onChange={(e) => setAddForm({ ...addForm, youtube_url: e.target.value })}
                placeholder="YouTube URL เช่น https://youtube.com/watch?v=..."
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
              {addPreviewId && (
                <div className="rounded-lg overflow-hidden border border-[#E2E8F0]">
                  <img src={`https://img.youtube.com/vi/${addPreviewId}/hqdefault.jpg`} alt="preview" className="w-full aspect-video object-cover" />
                  <p className="text-[11px] text-green-600 px-2 py-1 bg-green-50">✅ พบวิดีโอ ID: {addPreviewId}</p>
                </div>
              )}
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                rows={2}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
              />
              <button
                onClick={() => setAddConfirm(true)}
                disabled={!addForm.title.trim() || !addPreviewId}
                className="w-full py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium disabled:opacity-40"
              >
                เพิ่มคลิป
              </button>
            </div>

            {/* Video management list */}
            {loading ? (
              <div className="text-center py-8 text-[#374151]">กำลังโหลด...</div>
            ) : videos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">ยังไม่มีคลิป</div>
            ) : (
              <div className="space-y-3">
                {videos.map((v) => (
                  <div key={v.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                    <div className="flex gap-3 p-3">
                      <img
                        src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`}
                        alt={v.title}
                        className="w-24 h-16 object-cover rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#1E3A5F] line-clamp-1">{v.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatThaiDate(v.created_at)}</p>
                        <p className="text-xs font-semibold text-[#16A34A] mt-1">✅ {v.completion_count} คน ดูจบ</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => toggleStats(v.id)}
                          className="px-2 py-1 text-[11px] border border-[#E2E8F0] rounded-lg text-[#374151] hover:bg-gray-50"
                        >
                          {expandedStats[v.id] ? 'ซ่อน' : 'ดูรายชื่อ'}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(v)}
                          className="px-2 py-1 text-[11px] border border-red-200 rounded-lg text-[#DC2626] hover:bg-red-50"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                    {/* Stats expand */}
                    {loadingStats === v.id && (
                      <div className="px-4 py-2 text-xs text-gray-400 border-t border-[#E2E8F0]">กำลังโหลด...</div>
                    )}
                    {expandedStats[v.id] && (
                      <div className="border-t border-[#E2E8F0] px-4 py-3">
                        {expandedStats[v.id].length === 0 ? (
                          <p className="text-xs text-gray-400">ยังไม่มีพนักงานดูจบ</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {expandedStats[v.id].map((s) => (
                              <span key={s.employee_name} className="text-[11px] bg-green-50 text-[#16A34A] border border-green-200 px-2 py-0.5 rounded-full">
                                ✅ {s.employee_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: เลือกชื่อพนักงาน ── */}
      {nameModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div>
              <p className="text-2xl text-center mb-1">🎓</p>
              <h2 className="font-bold text-[#1E3A5F] text-center">ระบุตัวตน</h2>
              <p className="text-xs text-gray-500 text-center mt-1">เลือกแผนกและชื่อของคุณเพื่อติดตามความคืบหน้า</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1.5">แผนก</label>
              <select
                value={dept}
                onChange={(e) => { setDept(e.target.value); setSelectedName('') }}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              >
                <option value="">-- เลือกแผนก --</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {staffList.length > 0 && (
              <div>
                <label className="text-xs font-medium text-[#374151] block mb-1.5">ชื่อ</label>
                <select
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                >
                  <option value="">-- เลือกชื่อ --</option>
                  {staffList.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={confirmName}
              disabled={!selectedName}
              className="w-full py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium disabled:opacity-40"
            >
              ยืนยัน
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: YouTube Player ── */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-sm line-clamp-1">{playingVideo.title}</p>
              <button
                onClick={() => setPlayingVideo(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
              <div id="yt-player-div" className="w-full h-full" />
            </div>
            {completedIds.has(playingVideo.id) ? (
              <p className="text-center text-[#16A34A] font-semibold text-sm">✅ คุณดูคลิปนี้จบแล้ว</p>
            ) : (
              <p className="text-center text-white/60 text-xs">ดูให้จบเพื่อรับการยืนยัน ✅</p>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: ยืนยันเพิ่มคลิป ── */}
      {addConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-2xl">🎓</div>
            <div>
              <h2 className="font-bold text-[#1E3A5F]">ยืนยันเพิ่มคลิป</h2>
              <p className="text-sm text-[#374151] mt-1 font-medium">"{addForm.title}"</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm font-medium">ยกเลิก</button>
              <button onClick={handleAddVideo} disabled={addSaving} className="flex-1 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-60">
                {addSaving ? 'กำลังบันทึก...' : 'เพิ่มคลิป'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: ยืนยันลบ ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-2xl">🗑️</div>
            <div>
              <h2 className="font-bold text-[#374151]">ลบคลิปนี้?</h2>
              <p className="text-sm text-gray-500 mt-1">"{deleteTarget.title}"</p>
              <p className="text-xs text-[#DC2626] mt-2">ข้อมูลการดูของพนักงานทุกคนจะถูกลบด้วย</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm font-medium">ยกเลิก</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-lg bg-[#DC2626] text-white text-sm font-medium disabled:opacity-60">
                {deleting ? 'กำลังลบ...' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
