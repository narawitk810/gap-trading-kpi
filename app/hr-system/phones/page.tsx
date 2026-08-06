'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type PhoneEntry = {
  id: string
  name: string
  phone: string
  provider: string
  expire_date: string
  note: string
  days_until_expire: number
}

const PROVIDERS = ['AIS', 'DTAC', 'True', 'NT', 'อื่นๆ']

function formatThaiDate(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

function getStatus(days: number) {
  if (days < 0) return { label: 'หมดอายุแล้ว', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
  if (days <= 30) return { label: '⚠️ ต้องเติมด่วน', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
  return { label: 'ปกติ', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }
}

function getProviderColor(p: string) {
  const map: Record<string, string> = { AIS: '#F59E0B', DTAC: '#6366F1', True: '#DC2626', NT: '#1E3A5F' }
  return map[p] ?? '#374151'
}

const EMPTY_FORM = { name: '', phone: '', provider: 'AIS', expire_date: '', note: '' }

export default function PhonesPage() {
  const [entries, setEntries] = useState<PhoneEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addConfirm, setAddConfirm] = useState(false)
  const [addSaving, setAddSaving] = useState(false)

  // Edit modal (update expire_date)
  const [editTarget, setEditTarget] = useState<PhoneEntry | null>(null)
  const [editForm, setEditForm] = useState({ expire_date: '', note: '' })
  const [editConfirm, setEditConfirm] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<PhoneEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/phones')
    setEntries(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // ── Add ──────────────────────────────────────────────────────────────────
  async function handleAdd() {
    setAddSaving(true)
    await fetch('/api/hr/phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    setAddSaving(false)
    setAddOpen(false)
    setAddConfirm(false)
    setAddForm(EMPTY_FORM)
    fetchEntries()
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  function openEdit(entry: PhoneEntry) {
    setEditTarget(entry)
    setEditForm({ expire_date: entry.expire_date, note: entry.note })
    setEditConfirm(false)
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditSaving(true)
    await fetch('/api/hr/phones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editTarget.id, expire_date: editForm.expire_date, note: editForm.note }),
    })
    setEditSaving(false)
    setEditTarget(null)
    setEditConfirm(false)
    fetchEntries()
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/hr/phones?id=${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    fetchEntries()
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const urgent = entries.filter((e) => e.days_until_expire <= 30)
  const normal = entries.filter((e) => e.days_until_expire > 30)

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>

      {/* Header */}
      <header className="bg-[#1E3A5F] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/hr-system" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-lg shrink-0">←</Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-blue-200">จัดการเบอร์โทรและวันหมดอายุ</p>
            <h1 className="text-base font-bold">📱 ระบบเติมเบอร์มือถือ</h1>
          </div>
          <button
            onClick={() => { setAddForm(EMPTY_FORM); setAddOpen(true) }}
            className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium"
          >
            ➕ เพิ่มเบอร์
          </button>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ทั้งหมด', value: entries.length, color: '#1E3A5F', bg: '#EFF6FF' },
            { label: 'ต้องเติมด่วน', value: urgent.length, color: '#DC2626', bg: '#FEF2F2' },
            { label: 'ปกติ', value: normal.length, color: '#16A34A', bg: '#F0FDF4' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 border border-[#E2E8F0] text-center" style={{ backgroundColor: s.bg }}>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] text-[#374151] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-[#374151]">กำลังโหลด...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📱</p>
            <p className="font-semibold text-[#374151]">ยังไม่มีเบอร์โทร</p>
            <p className="text-sm text-gray-400 mt-1">กด "เพิ่มเบอร์" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const status = getStatus(entry.days_until_expire)
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border overflow-hidden"
                  style={{ borderColor: entry.days_until_expire <= 30 ? '#FECACA' : '#E2E8F0' }}
                >
                  <div className="p-4">
                    {/* Row 1: name + badges */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#1E3A5F] text-sm">{entry.name}</p>
                        {entry.provider && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: getProviderColor(entry.provider) }}
                          >
                            {entry.provider}
                          </span>
                        )}
                      </div>
                      <span
                        className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ color: status.color, backgroundColor: status.bg, borderColor: status.border }}
                      >
                        {status.label}
                      </span>
                    </div>

                    {/* Row 2: phone number */}
                    <p className="text-2xl font-bold text-[#374151] tracking-widest mb-2">{entry.phone}</p>

                    {/* Row 3: expire */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[11px] text-gray-400">วันหมดอายุ</p>
                        <p className="text-sm font-medium text-[#374151]">{formatThaiDate(entry.expire_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-gray-400">คงเหลือ</p>
                        <p
                          className="text-sm font-bold"
                          style={{ color: status.color }}
                        >
                          {entry.days_until_expire < 0
                            ? `เกินกำหนด ${Math.abs(entry.days_until_expire)} วัน`
                            : `${entry.days_until_expire} วัน`}
                        </p>
                      </div>
                    </div>

                    {entry.note && (
                      <p className="text-xs text-gray-400 mb-3 italic">หมายเหตุ: {entry.note}</p>
                    )}

                    {/* Row 4: actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(entry)}
                        className="flex-1 py-2 rounded-lg border border-[#1E3A5F] text-[#1E3A5F] text-xs font-medium hover:bg-[#1E3A5F] hover:text-white transition-colors"
                      >
                        🔄 อัปเดตวันเติม
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="w-10 flex items-center justify-center rounded-lg border border-[#E2E8F0] text-[#DC2626] hover:bg-red-50 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: เพิ่มเบอร์ ── */}
      {addOpen && !addConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h2 className="font-bold text-[#1E3A5F]">➕ เพิ่มเบอร์ใหม่</h2>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder="ชื่อ/ป้ายกำกับ เช่น เบอร์ไลฟ์สด 1"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            <input
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              placeholder="เบอร์โทร เช่น 0812345678"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1.5">เครือข่าย</label>
              <div className="flex gap-2 flex-wrap">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAddForm({ ...addForm, provider: p })}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      addForm.provider === p
                        ? 'text-white border-transparent'
                        : 'bg-white border-[#E2E8F0] text-[#374151]'
                    }`}
                    style={addForm.provider === p ? { backgroundColor: getProviderColor(p) } : {}}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1.5">วันหมดอายุ</label>
              <input
                type="date"
                value={addForm.expire_date}
                onChange={(e) => setAddForm({ ...addForm, expire_date: e.target.value })}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <input
              type="text"
              value={addForm.note}
              onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            <div className="flex gap-2">
              <button onClick={() => setAddOpen(false)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm">ยกเลิก</button>
              <button
                onClick={() => setAddConfirm(true)}
                disabled={!addForm.name.trim() || !addForm.phone.trim() || !addForm.expire_date}
                className="flex-1 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: ยืนยันเพิ่มเบอร์ ── */}
      {addOpen && addConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-2xl">📱</div>
            <div>
              <h2 className="font-bold text-[#1E3A5F]">ยืนยันเพิ่มเบอร์</h2>
              <p className="text-base font-bold text-[#374151] mt-2 tracking-widest">{addForm.phone}</p>
              <p className="text-sm text-gray-500">{addForm.name} · {addForm.provider}</p>
              <p className="text-sm text-gray-500 mt-1">หมดอายุ {formatThaiDate(addForm.expire_date)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm">แก้ไข</button>
              <button onClick={handleAdd} disabled={addSaving} className="flex-1 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-60">
                {addSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: อัปเดตวันเติม ── */}
      {editTarget && !editConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-[#1E3A5F]">🔄 อัปเดตวันเติม</h2>
              <p className="text-sm text-gray-500 mt-0.5">{editTarget.phone} · {editTarget.name}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1.5">วันหมดอายุใหม่</label>
              <input
                type="date"
                value={editForm.expire_date}
                onChange={(e) => setEditForm({ ...editForm, expire_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <input
              type="text"
              value={editForm.note}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm">ยกเลิก</button>
              <button
                onClick={() => setEditConfirm(true)}
                disabled={!editForm.expire_date}
                className="flex-1 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-40"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: ยืนยันอัปเดต ── */}
      {editTarget && editConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-2xl">🔄</div>
            <div>
              <h2 className="font-bold text-[#1E3A5F]">ยืนยันการอัปเดต</h2>
              <p className="text-sm text-gray-500 mt-1">{editTarget.phone}</p>
              <p className="text-sm font-bold text-[#1E3A5F] mt-1">หมดอายุใหม่: {formatThaiDate(editForm.expire_date)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm">แก้ไข</button>
              <button onClick={handleEdit} disabled={editSaving} className="flex-1 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-medium disabled:opacity-60">
                {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
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
              <h2 className="font-bold text-[#374151]">ลบเบอร์นี้?</h2>
              <p className="text-base font-bold text-[#374151] mt-1 tracking-widest">{deleteTarget.phone}</p>
              <p className="text-sm text-gray-500">{deleteTarget.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm">ยกเลิก</button>
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
