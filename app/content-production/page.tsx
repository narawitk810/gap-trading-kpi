'use client'
import { useState, useEffect, useCallback } from 'react'

type ClipStatus = 'raw' | 'assigned' | 'submitted' | 'reviewing' | 'recorded'
type ModalState = 'detail' | 'action_form' | 'submitting'

interface ContentClip {
  id: string
  title: string
  drive_link: string
  shoot_date: string
  created_by: string
  status: ClipStatus
  assigned_to?: string
  assigned_at?: string
  platform_links?: string
  submitted_at?: string
  days_to_submit?: number
  review_result?: string
  reviewed_by?: string
  reviewed_at?: string
  views?: number
  avg_watch_time?: string
  likes?: number
  result_recorded_at?: string
  created_at: string
}

interface PlatformLinks {
  tiktok: string
  facebook: string
  youtube: string
  instagram: string
}

const STAGES: { key: ClipStatus; label: string; num: string; color: string; activeColor: string }[] = [
  { key: 'raw', label: 'คลิปดิบ+มอบหมาย', num: '1', color: 'bg-gray-100 text-gray-600 border border-gray-200', activeColor: 'bg-[#374151] text-white' },
  { key: 'assigned', label: 'มอบหมาย+ส่งงาน+โพส', num: '2', color: 'bg-yellow-50 text-yellow-700 border border-yellow-200', activeColor: 'bg-yellow-500 text-white' },
  { key: 'submitted', label: 'งานแก้', num: '2.5', color: 'bg-blue-50 text-blue-700 border border-blue-200', activeColor: 'bg-blue-600 text-white' },
  { key: 'reviewing', label: 'รอตรวจสอบ', num: '3', color: 'bg-orange-50 text-orange-700 border border-orange-200', activeColor: 'bg-orange-500 text-white' },
  { key: 'recorded', label: 'บันทึกผล', num: '4', color: 'bg-green-50 text-green-700 border border-green-200', activeColor: 'bg-[#16A34A] text-white' },
]

const PLATFORM_LABELS: Record<keyof PlatformLinks, string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

function fmtDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function daysSince(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function ContentProductionPage() {
  const [clips, setClips] = useState<ContentClip[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<ClipStatus>('raw')
  const [selected, setSelected] = useState<ContentClip | null>(null)
  const [modalState, setModalState] = useState<ModalState>('detail')
  const [creativeStaff, setCreativeStaff] = useState<string[]>([])
  const [guideOpen, setGuideOpen] = useState(false)

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', drive_link: '', shoot_date: '', created_by: '' })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Action form state
  const [assignTo, setAssignTo] = useState('')
  const [platformLinks, setPlatformLinks] = useState<PlatformLinks>({ tiktok: '', facebook: '', youtube: '', instagram: '' })
  const [reviewedBy, setReviewedBy] = useState('')
  const [resultViews, setResultViews] = useState('')
  const [resultWatchTime, setResultWatchTime] = useState('')
  const [resultLikes, setResultLikes] = useState('')
  const [actionError, setActionError] = useState('')

  const fetchClips = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/content-clips')
    const data = await res.json()
    setClips(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchClips()
    fetch('/api/live-staff')
      .then(r => r.json())
      .then((data: { staff: { name: string; department: string }[] }) =>
        setCreativeStaff((data.staff || []).filter(s => s.department === 'Creative').map(s => s.name))
      )
  }, [fetchClips])

  const filtered = clips.filter(c => c.status === selectedStatus)
  const counts = Object.fromEntries(STAGES.map(s => [s.key, clips.filter(c => c.status === s.key).length]))

  function openDetail(clip: ContentClip) {
    setSelected(clip)
    setModalState('detail')
    setAssignTo('')
    setPlatformLinks({ tiktok: '', facebook: '', youtube: '', instagram: '' })
    setReviewedBy('')
    setResultViews('')
    setResultWatchTime('')
    setResultLikes('')
    setActionError('')
  }

  async function handleCreate() {
    if (!createForm.title.trim() || !createForm.drive_link.trim() || !createForm.shoot_date || !createForm.created_by.trim()) {
      setCreateError('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setCreating(true)
    const res = await fetch('/api/content-clips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) })
    setCreating(false)
    if (!res.ok) { const d = await res.json(); setCreateError(d.error || 'เกิดข้อผิดพลาด'); return }
    setShowCreate(false)
    setCreateForm({ title: '', drive_link: '', shoot_date: '', created_by: '' })
    setCreateError('')
    fetchClips()
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm(`ลบ "${selected.title}" ออกจากระบบ? ไม่สามารถกู้คืนได้`)) return
    setModalState('submitting')
    await fetch(`/api/content-clips/${selected.id}`, { method: 'DELETE' })
    setSelected(null)
    fetchClips()
  }

  async function handleRollback() {
    if (!selected) return
    if (!window.confirm('ย้อนกลับไปสถานะก่อนหน้า?')) return
    setModalState('submitting')
    const res = await fetch(`/api/content-clips/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rollback' }),
    })
    const data = await res.json()
    if (!res.ok) { setActionError(data.error || 'เกิดข้อผิดพลาด'); setModalState('detail'); return }
    setSelected(null)
    fetchClips()
  }

  async function handleAction(action: string) {
    if (!selected) return
    setModalState('submitting')
    const payload: Record<string, unknown> = { action }

    if (action === 'assign') { payload.assigned_to = assignTo }
    else if (action === 'submit') { payload.platform_links = platformLinks }
    else if (action === 'pass' || action === 'revise') { payload.reviewed_by = reviewedBy }
    else if (action === 'record_result') { payload.views = resultViews; payload.avg_watch_time = resultWatchTime; payload.likes = resultLikes }

    const res = await fetch(`/api/content-clips/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setActionError(data.error || 'เกิดข้อผิดพลาด'); setModalState('action_form'); return }
    setSelected(null)
    fetchClips()
  }

  const parsedLinks = selected?.platform_links ? JSON.parse(selected.platform_links) as PlatformLinks : null

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-4 flex items-center gap-3">
        <a href="/" className="text-white/70 text-sm">← กลับ</a>
        <h1 className="text-base font-bold flex-1">ระบบผลิตคอนเทนต์</h1>
        <button onClick={fetchClips} className="text-white/70 text-sm px-2 py-1 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors">⟳ รีเฟรช</button>
      </div>

      {/* Pipeline Strip */}
      <div className="px-4 pt-4 pb-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <button
                onClick={() => setSelectedStatus(s.key)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${selectedStatus === s.key ? s.activeColor : s.color}`}
              >
                สถานะที่ {s.num} {s.label} <span className="ml-1 opacity-75">({counts[s.key] ?? 0})</span>
              </button>
              {i < STAGES.length - 1 && <span className="text-gray-300 text-sm">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Guide */}
      <div className="px-4 pt-1 pb-2">
        <button
          onClick={() => setGuideOpen(v => !v)}
          className="w-full flex items-center justify-between text-xs text-gray-500 py-1.5 px-3 bg-gray-50 rounded-xl border border-[#E2E8F0]"
        >
          <span>📋 คู่มือ — ใครดำเนินการสถานะไหน</span>
          <span>{guideOpen ? '▲' : '▼'}</span>
        </button>
        {guideOpen && (
          <div className="mt-2 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden text-xs">
            {[
              { num: '1', label: 'คลิปดิบ+มอบหมาย', actor: 'Senior Creative หรือ ผู้จัดการ', managerRole: true },
              { num: '2', label: 'มอบหมาย+ส่งงาน+โพส', actor: 'ผู้รับผิดชอบคลิปนั้นๆ', managerRole: false },
              { num: '2.5', label: 'งานแก้', actor: 'ผู้รับผิดชอบคลิปนั้นๆ', managerRole: false },
              { num: '3', label: 'รอตรวจสอบ', actor: 'Senior Creative หรือ ผู้จัดการ', managerRole: true },
              { num: '4', label: 'บันทึกผล', actor: 'ผู้รับผิดชอบคลิปนั้นๆ', managerRole: false },
            ].map((row, i) => (
              <div key={row.num} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-[#E2E8F0]' : ''}`}>
                <span className="shrink-0 font-bold text-[#1E3A5F] w-12">สถานะ<br/>{row.num}</span>
                <span className="text-gray-500 flex-1">{row.label}</span>
                <span className={`shrink-0 font-medium text-right ${row.managerRole ? 'text-[#1E3A5F]' : 'text-[#16A34A]'}`}>{row.actor}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="px-4 py-2 space-y-2">
        <a
          href="https://drive.google.com/drive/folders/1GM33p4AvefmgVjd8-yVt768-4bXvd3mx?usp=sharing"
          target="_blank"
          rel="noreferrer"
          className="w-full py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[#374151] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#F5F6F8] transition-colors"
        >
          <span>📁</span> ลิ้ง Google Drive สำหรับโยนไฟล์ดิบ
        </a>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#1E3A5F]/30 text-[#1E3A5F] text-sm font-semibold hover:bg-[#1E3A5F]/5 transition-colors"
        >
          + เพิ่มคลิปใหม่
        </button>
      </div>

      {/* Clip List */}
      <div className="px-4 pb-8 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">ไม่มีคลิปในสถานะนี้</p>
        ) : filtered.map(clip => (
          <button
            key={clip.id}
            onClick={() => openDetail(clip)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1E3A5F] text-sm truncate">{clip.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">ถ่าย {fmtDate(clip.shoot_date)} · โดย {clip.created_by}</p>
                {clip.assigned_to && (
                  <p className="text-xs text-gray-500 mt-1">มอบหมาย: <span className="font-medium text-[#374151]">{clip.assigned_to}</span></p>
                )}
                {clip.submitted_at && (
                  <p className="text-xs text-gray-400 mt-0.5">ส่งงานแล้ว · ใช้เวลา {clip.days_to_submit ?? 0} วัน</p>
                )}
                {clip.review_result === 'revise' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full font-medium">แก้ไข</span>
                )}
                {clip.result_recorded_at && (
                  <p className="text-xs text-green-600 mt-0.5">บันทึกผลแล้ว</p>
                )}
              </div>
              <span className="text-gray-300 text-lg shrink-0">›</span>
            </div>
          </button>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <h2 className="font-bold text-[#1E3A5F] text-base">เพิ่มคลิปใหม่</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">ชื่อคลิป <span className="text-[#DC2626]">*</span></label>
                <input value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} placeholder="ชื่อคลิป" className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">ลิ้งค์ Google Drive <span className="text-[#DC2626]">*</span></label>
                <input type="url" value={createForm.drive_link} onChange={e => setCreateForm(p => ({ ...p, drive_link: e.target.value }))} placeholder="https://drive.google.com/..." className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">วันที่ถ่าย <span className="text-[#DC2626]">*</span></label>
                <input type="date" value={createForm.shoot_date} onChange={e => setCreateForm(p => ({ ...p, shoot_date: e.target.value }))} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">ชื่อผู้สร้าง <span className="text-[#DC2626]">*</span></label>
                <input value={createForm.created_by} onChange={e => setCreateForm(p => ({ ...p, created_by: e.target.value }))} placeholder="ชื่อผู้สร้าง" className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
            </div>
            {createError && <p className="text-[#DC2626] text-xs">{createError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowCreate(false); setCreateError('') }} className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-gray-500">ยกเลิก</button>
              <button onClick={handleCreate} disabled={creating} className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50">
                {creating ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#1E3A5F] text-sm">{selected.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">สถานะที่ {STAGES.find(s => s.key === selected.status)?.num} — {STAGES.find(s => s.key === selected.status)?.label}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 text-xl leading-none">×</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {modalState === 'submitting' && (
                <p className="text-center text-gray-400 text-sm py-8">กำลังบันทึก...</p>
              )}

              {(modalState === 'detail' || modalState === 'action_form') && (
                <>
                  {/* Step 1 info — always shown */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">คลิปดิบ</p>
                    <div className="bg-[#F5F6F8] rounded-xl p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">ชื่อคลิป</span><span className="font-medium text-[#374151]">{selected.title}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">วันที่ถ่าย</span><span className="font-medium text-[#374151]">{fmtDate(selected.shoot_date)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">สร้างโดย</span><span className="font-medium text-[#374151]">{selected.created_by}</span></div>
                      <a href={selected.drive_link} target="_blank" rel="noreferrer" className="block text-[#1E3A5F] text-xs underline truncate">{selected.drive_link}</a>
                    </div>
                  </div>

                  {/* Step 2 info */}
                  {['assigned', 'submitted', 'reviewing', 'recorded'].includes(selected.status) && selected.assigned_to && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">มอบหมาย</p>
                      <div className="bg-[#F5F6F8] rounded-xl p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">มอบหมายให้</span><span className="font-medium text-[#374151]">{selected.assigned_to}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">วันที่</span><span className="text-[#374151]">{fmtDate(selected.assigned_at ?? '')}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Step 3 info — platform links */}
                  {['reviewing', 'recorded'].includes(selected.status) && parsedLinks && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ลิ้งค์โพส</p>
                      <div className="bg-[#F5F6F8] rounded-xl p-3 space-y-1.5 text-sm">
                        {selected.days_to_submit !== undefined && (
                          <p className="text-gray-500">ใช้เวลา <span className="font-semibold text-[#1E3A5F]">{selected.days_to_submit} วัน</span> จากวันมอบหมาย</p>
                        )}
                        {(Object.entries(parsedLinks) as [keyof PlatformLinks, string][]).filter(([, v]) => v?.trim()).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-gray-500 text-xs">{PLATFORM_LABELS[k]}: </span>
                            <a href={v} target="_blank" rel="noreferrer" className="text-[#1E3A5F] text-xs underline truncate">{v}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 4 info — review result */}
                  {['recorded'].includes(selected.status) && selected.review_result && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ผลการตรวจสอบ</p>
                      <div className="bg-[#F5F6F8] rounded-xl p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">ผล</span>
                          <span className={`font-semibold ${selected.review_result === 'pass' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {selected.review_result === 'pass' ? 'ผ่าน' : 'ลบ+แก้ไข'}
                          </span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-500">ตรวจโดย</span><span className="text-[#374151]">{selected.reviewed_by}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">วันที่</span><span className="text-[#374151]">{fmtDate(selected.reviewed_at ?? '')}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Step 5 info — recorded metrics */}
                  {selected.status === 'recorded' && selected.result_recorded_at && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ผลลัพธ์</p>
                      <div className="bg-[#F5F6F8] rounded-xl p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">ยอดวิว</span><span className="font-semibold text-[#1E3A5F]">{selected.views?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">เวลาดูเฉลี่ย</span><span className="font-medium text-[#374151]">{selected.avg_watch_time}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">ถูกใจ</span><span className="font-semibold text-[#1E3A5F]">{selected.likes?.toLocaleString()}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Revision notice */}
                  {selected.status === 'submitted' && selected.review_result === 'revise' && (
                    <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">
                      คลิปนี้ถูกส่งกลับมาให้แก้ไข — กรุณาแนบลิ้งค์โพสใหม่อีกครั้ง
                    </div>
                  )}

                  {actionError && <p className="text-[#DC2626] text-xs">{actionError}</p>}

                  {/* Action form content */}
                  {modalState === 'action_form' && (
                    <div className="space-y-3">
                      {/* ASSIGN */}
                      {selected.status === 'raw' && (
                        <>
                          <div>
                            <label className="text-xs font-semibold text-[#374151] block mb-1">มอบหมายให้ <span className="text-[#DC2626]">*</span></label>
                            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                              <option value="">เลือกชื่อพนักงาน</option>
                              {creativeStaff.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <button onClick={() => handleAction('assign')} className="w-full py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold">ยืนยันมอบหมาย</button>
                        </>
                      )}

                      {/* SUBMIT LINKS */}
                      {(selected.status === 'assigned' || selected.status === 'submitted') && (
                        <>
                          <p className="text-xs text-gray-500">แนบลิ้งค์โพสอย่างน้อย 1 platform</p>
                          {(Object.keys(PLATFORM_LABELS) as (keyof PlatformLinks)[]).map(k => (
                            <div key={k}>
                              <label className="text-xs font-semibold text-[#374151] block mb-1">{PLATFORM_LABELS[k]}</label>
                              <input type="url" value={platformLinks[k]} onChange={e => setPlatformLinks(p => ({ ...p, [k]: e.target.value }))} placeholder={`https://...`} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                            </div>
                          ))}
                          <button onClick={() => handleAction('submit')} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold">ส่งลิ้งค์</button>
                        </>
                      )}

                      {/* REVIEW */}
                      {selected.status === 'reviewing' && (
                        <>
                          <div>
                            <label className="text-xs font-semibold text-[#374151] block mb-1">ชื่อผู้ตรวจสอบ <span className="text-[#DC2626]">*</span></label>
                            <input value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} placeholder="ชื่อหัวหน้า" className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAction('pass')} className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold">✓ ผ่าน</button>
                            <button onClick={() => handleAction('revise')} className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold">ลบ+แก้ไข</button>
                          </div>
                        </>
                      )}

                      {/* RECORD RESULT */}
                      {selected.status === 'recorded' && !selected.result_recorded_at && (
                        <>
                          {selected.submitted_at && (() => {
                            const daysLeft = 15 - daysSince(selected.submitted_at)
                            return <p className={`text-xs font-medium ${daysLeft <= 3 ? 'text-[#DC2626]' : 'text-gray-500'}`}>เหลือเวลาอีก {Math.max(0, daysLeft)} วัน (ครบกำหนด 15 วัน)</p>
                          })()}
                          <div>
                            <label className="text-xs font-semibold text-[#374151] block mb-1">ยอดวิว <span className="text-[#DC2626]">*</span></label>
                            <input type="number" value={resultViews} onChange={e => setResultViews(e.target.value)} placeholder="เช่น 12500" className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#374151] block mb-1">เวลาดูเฉลี่ยต่อคลิป</label>
                            <input value={resultWatchTime} onChange={e => setResultWatchTime(e.target.value)} placeholder="เช่น 1:32" className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#374151] block mb-1">จำนวนถูกใจ <span className="text-[#DC2626]">*</span></label>
                            <input type="number" value={resultLikes} onChange={e => setResultLikes(e.target.value)} placeholder="เช่น 430" className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                          </div>
                          <button onClick={() => handleAction('record_result')} className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold">บันทึกผล</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Action trigger buttons (shown in detail view) */}
                  {modalState === 'detail' && (
                    <div className="pt-2 space-y-2">
                      {selected.status === 'raw' && (
                        <button onClick={() => setModalState('action_form')} className="w-full py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold">มอบหมายงาน</button>
                      )}
                      {(selected.status === 'assigned' || selected.status === 'submitted') && (
                        <button onClick={() => setModalState('action_form')} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                          {selected.status === 'submitted' ? 'แนบลิ้งค์ใหม่' : 'แนบลิ้งค์โพส'}
                        </button>
                      )}
                      {selected.status === 'reviewing' && (
                        <button onClick={() => setModalState('action_form')} className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold">ตรวจสอบ</button>
                      )}
                      {selected.status === 'recorded' && !selected.result_recorded_at && (
                        <button onClick={() => setModalState('action_form')} className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold">บันทึกผล</button>
                      )}
                      {selected.status === 'recorded' && selected.result_recorded_at && (
                        <div className="py-2 text-center text-sm text-[#16A34A] font-semibold">เสร็จสิ้น ✓</div>
                      )}
                      <div className="flex gap-2 pt-1 border-t border-[#E2E8F0] mt-2">
                        {selected.status !== 'raw' && (
                          <button onClick={handleRollback} className="flex-1 py-2 rounded-xl border border-[#E2E8F0] text-sm text-gray-500 hover:bg-gray-50 transition-colors">← ย้อนกลับ</button>
                        )}
                        <button onClick={handleDelete} className="flex-1 py-2 rounded-xl border border-[#DC2626] text-sm text-[#DC2626] hover:bg-red-50 transition-colors">ลบงานนี้</button>
                      </div>
                    </div>
                  )}

                  {modalState === 'action_form' && (
                    <button onClick={() => { setModalState('detail'); setActionError('') }} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">← ยกเลิก</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
