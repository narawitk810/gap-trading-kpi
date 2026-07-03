'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const MAX_PER_SLOT = 3
const HOURS = Array.from({ length: 12 }, (_, i) => i + 9)

function getTodayDate() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`
}

interface Booking { id: string; nickname: string }

export default function BreakAdminPage() {
  const [date, setDate] = useState(getTodayDate())
  const [slots, setSlots] = useState<Record<number, Booking[]>>({})
  const [loading, setLoading] = useState(false)
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

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleCancel(id: string) {
    setCancelling(id)
    const res = await fetch('/api/breaks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { showToast('ยกเลิกการจองแล้ว', true); fetchSlots() }
    else showToast('ยกเลิกไม่สำเร็จ', false)
    setCancelling(null)
  }

  const totalBookings = Object.values(slots).reduce((s, list) => s + list.length, 0)
  const fullSlots = HOURS.filter((h) => (slots[h] || []).length >= MAX_PER_SLOT).length
  const emptySlots = HOURS.filter((h) => (slots[h] || []).length === 0).length

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">GAP TRADING</h1>
            <p className="text-sm mt-0.5 opacity-75">Admin — ภาพรวมการจองพัก</p>
          </div>
          <Link href="/" className="text-xs opacity-60 hover:opacity-100 underline underline-offset-2">
            ← หน้าหลัก
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-12">

        {/* Date picker */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <label className="text-sm font-semibold text-[#374151] whitespace-nowrap">วันที่</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
          />
          <button onClick={fetchSlots} className="text-xs bg-[#1E3A5F] text-white px-4 py-2.5 rounded-xl font-semibold whitespace-nowrap">
            รีเฟรช
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-[#1E3A5F]">{totalBookings}</p>
            <p className="text-xs text-gray-400 mt-1">จองทั้งหมด</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-[#DC2626]">{fullSlots}</p>
            <p className="text-xs text-gray-400 mt-1">ช่วงเต็ม</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-[#16A34A]">{emptySlots}</p>
            <p className="text-xs text-gray-400 mt-1">ช่วงว่าง</p>
          </div>
        </div>

        {/* Slots table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <p className="text-sm font-bold text-[#374151]">รายละเอียดแต่ละช่วง</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-[#1E3A5F]/20 border-t-[#1E3A5F] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {HOURS.map((h) => {
                const list = slots[h] || []
                const count = list.length
                const full = count >= MAX_PER_SLOT

                return (
                  <div key={h} className={`px-4 py-3 ${full ? 'bg-[#DC2626]/5' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Hour + bar */}
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-semibold text-[#374151]">{hourLabel(h)}</p>
                        {/* capacity bar */}
                        <div className="flex gap-1 mt-1.5">
                          {Array.from({ length: MAX_PER_SLOT }).map((_, i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${i < count
                                ? full ? 'bg-[#DC2626]' : count === MAX_PER_SLOT - 1 ? 'bg-amber-400' : 'bg-[#16A34A]'
                                : 'bg-[#E2E8F0]'}`}
                            />
                          ))}
                        </div>
                        <p className={`text-[11px] font-semibold mt-1 ${full ? 'text-[#DC2626]' : 'text-gray-400'}`}>
                          {count}/{MAX_PER_SLOT} คน
                        </p>
                      </div>

                      {/* Name list */}
                      <div className="flex-1 flex flex-wrap gap-2">
                        {list.length === 0 ? (
                          <span className="text-xs text-gray-300 italic">ยังไม่มีการจอง</span>
                        ) : list.map((b) => (
                          <div key={b.id} className="flex items-center gap-1.5 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-1.5">
                            <span className="text-sm font-medium text-[#374151]">{b.nickname}</span>
                            <button
                              onClick={() => handleCancel(b.id)}
                              disabled={cancelling === b.id}
                              className="text-[#DC2626] text-xs font-bold hover:opacity-70 disabled:opacity-40 ml-1"
                              title="ยกเลิกการจอง"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Link to employee page */}
        <Link
          href="/break"
          className="flex items-center justify-center gap-2 border-2 border-[#1E3A5F] text-[#1E3A5F] rounded-xl py-3 font-semibold text-sm hover:bg-[#1E3A5F]/5 transition-colors"
        >
          ☕ ไปหน้าจองพักพนักงาน
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg z-50 ${toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
