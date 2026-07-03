'use client'

import { useState, useEffect, useCallback } from 'react'

const MAX_PER_SLOT = 3
const HOURS = Array.from({ length: 12 }, (_, i) => i + 9) // 09:00 – 20:00

function getTodayDate() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`
}

interface Booking { id: string; nickname: string }

export default function BreakPage() {
  const [nickname, setNickname] = useState('')
  const [date, setDate] = useState(getTodayDate())
  const [slots, setSlots] = useState<Record<number, Booking[]>>({})
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<number | null>(null)
  const [myBookings, setMyBookings] = useState<{ id: string; hour_slot: number }[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/breaks?date=${date}`)
      const data = await res.json()
      setSlots(data.slots || {})
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  // sync myBookings from slots whenever slots or nickname changes
  useEffect(() => {
    if (!nickname.trim()) { setMyBookings([]); return }
    const found: { id: string; hour_slot: number }[] = []
    for (const [h, list] of Object.entries(slots)) {
      for (const b of list) {
        if (b.nickname === nickname.trim()) found.push({ id: b.id, hour_slot: Number(h) })
      }
    }
    setMyBookings(found)
  }, [slots, nickname])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleBook(hour: number) {
    if (!nickname.trim()) { showToast('กรุณากรอกชื่อเล่นก่อน', false); return }
    setConfirm(null)
    const res = await fetch('/api/breaks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nickname.trim(), date, hour_slot: hour }),
    })
    const data = await res.json()
    if (res.ok) { showToast('จองพักสำเร็จแล้ว ✓', true); fetchSlots() }
    else showToast(data.error || 'เกิดข้อผิดพลาด', false)
  }

  async function handleCancel(id: string) {
    setCancelling(id)
    const res = await fetch('/api/breaks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { showToast('ยกเลิกการจองแล้ว', true); fetchSlots() }
    else showToast('ยกเลิกไม่สำเร็จ กรุณาลองใหม่', false)
    setCancelling(null)
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md">
        <h1 className="text-xl font-bold">GAP TRADING</h1>
        <p className="text-sm mt-1 opacity-75">จองเวลาพัก</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-12">

        {/* Rule notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex gap-3 items-start">
          <span className="text-lg mt-0.5">☕</span>
          <p className="text-sm text-amber-800 font-medium leading-relaxed">
            แต่ละช่วงชั่วโมง พักได้ <span className="font-bold">ไม่เกิน {MAX_PER_SLOT} คน</span> พร้อมกัน
          </p>
        </div>

        {/* ชื่อ + วันที่ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              ชื่อเล่น <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="ชื่อเล่นของคุณ"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">วันที่</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
        </div>

        {/* My bookings */}
        {myBookings.length > 0 && (
          <div className="bg-[#16A34A]/5 border border-[#16A34A]/30 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-[#16A34A]">การจองของคุณ</p>
            {myBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#374151] font-medium">{hourLabel(b.hour_slot)}</span>
                <button
                  onClick={() => handleCancel(b.id)}
                  disabled={cancelling === b.id}
                  className="text-xs text-[#DC2626] border border-[#DC2626]/40 rounded-lg px-3 py-1.5 font-semibold hover:bg-[#DC2626]/5 disabled:opacity-50"
                >
                  {cancelling === b.id ? 'กำลังยกเลิก...' : 'ยกเลิก'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Time slots */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[#374151]">เลือกช่วงเวลาพัก</p>
            <button onClick={fetchSlots} className="text-xs text-[#1E3A5F] font-semibold underline underline-offset-2">
              รีเฟรช
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-[#1E3A5F]/20 border-t-[#1E3A5F] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {HOURS.map((h) => {
                const list = slots[h] || []
                const count = list.length
                const full = count >= MAX_PER_SLOT
                const isMine = myBookings.some((b) => b.hour_slot === h)
                const remaining = MAX_PER_SLOT - count

                let bg = 'bg-white border-[#E2E8F0]'
                let badge = ''
                let badgeColor = ''
                if (isMine) { bg = 'bg-[#16A34A]/5 border-[#16A34A]/40'; badge = 'จองแล้ว'; badgeColor = 'bg-[#16A34A] text-white' }
                else if (full) { bg = 'bg-[#DC2626]/5 border-[#DC2626]/30'; badge = 'เต็ม'; badgeColor = 'bg-[#DC2626] text-white' }
                else if (remaining === 1) { bg = 'bg-amber-50 border-amber-200'; badge = 'เหลือ 1'; badgeColor = 'bg-amber-500 text-white' }
                else { badge = `ว่าง ${remaining}`; badgeColor = 'bg-[#E2E8F0] text-[#374151]' }

                return (
                  <div key={h} className={`border rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${bg}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-[#374151] whitespace-nowrap">{hourLabel(h)}</span>
                      <div className="flex gap-1 flex-wrap">
                        {list.map((b) => (
                          <span key={b.id} className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-full px-2 py-0.5 font-medium">
                            {b.nickname}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
                      {!full && !isMine && (
                        <button
                          onClick={() => setConfirm(h)}
                          className="text-xs bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#1E3A5F]/90"
                        >
                          จอง
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirm !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
            <div className="bg-[#1E3A5F] text-white px-5 py-4 text-center">
              <div className="text-3xl mb-1">☕</div>
              <h3 className="font-bold text-base">ยืนยันการจองพัก</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#F5F6F8] rounded-xl p-4 text-center space-y-1">
                <p className="text-xs text-gray-400">ช่วงเวลา</p>
                <p className="text-lg font-bold text-[#1E3A5F]">{hourLabel(confirm)}</p>
                <p className="text-xs text-gray-400">{date}</p>
                {nickname.trim() && <p className="text-sm font-semibold text-[#374151] mt-1">{nickname.trim()}</p>}
              </div>
              <p className="text-xs text-gray-500 text-center">กดยืนยันเพื่อจองช่วงพักนี้</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 py-3 rounded-xl border-2 border-[#E2E8F0] text-[#374151] font-semibold text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleBook(confirm)}
                  className="flex-1 py-3 rounded-xl bg-[#16A34A] text-white font-bold text-sm"
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg z-50 ${toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
