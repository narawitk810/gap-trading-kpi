'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const NICKNAME_KEY = 'gap_kpi_nickname'
const DEPT_KEY = 'gap_kpi_department'

function toMin(t: string) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function fmtHours(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`
}
function calcMins(start: string, end: string) {
  const s = toMin(start), e = toMin(end)
  if (s === null || e === null) return null
  return (e <= s ? e + 1440 : e) - s
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function buddhistMonthYear(isoMonth: string) {
  const [y, m] = isoMonth.split('-').map(Number)
  return `${THAI_MONTHS[m - 1]} ${y + 543}`
}

interface Entry {
  id: string
  department: string
  date: string
  time: string
  nickname: string
  channels: string[]
  tasks: string[]
  obstacles: string
  extra: Record<string, unknown>
  created_at: string
}

function getTotalSales(ex: Record<string, unknown>): number {
  return (['sales_shopee', 'sales_tiktok', 'sales_outside_tiktok', 'sales_outside_fb', 'sales_amount'] as const)
    .reduce<number>((s, k) => s + (parseFloat(String(ex[k] || '')) || 0), 0)
}

function EntryCard({ entry }: { entry: Entry }) {
  const ex = entry.extra
  const ttMin = calcMins(String(ex.tiktok_start || ''), String(ex.tiktok_end || ''))
  const fbMin = calcMins(String(ex.fb_start || ''), String(ex.fb_end || ''))
  const totalLive = (ttMin ?? 0) + (fbMin ?? 0)
  const legacyLiveHours = String(ex.live_hours || '')
  const hasLiveHours = ttMin !== null || fbMin !== null || legacyLiveHours.length > 0
  const totalSales = getTotalSales(ex)
  const shopeeAmt = parseFloat(String(ex.sales_shopee || '')) || 0
  const tiktokAmt = parseFloat(String(ex.sales_tiktok || '')) || 0
  const outsideTtAmt = parseFloat(String(ex.sales_outside_tiktok || '')) || 0
  const outsideFbAmt = parseFloat(String(ex.sales_outside_fb || '')) || 0
  const legacyAmt = parseFloat(String(ex.sales_amount || '')) || 0
  const hasNewFormat = tiktokAmt > 0 || shopeeAmt > 0 || outsideTtAmt > 0 || outsideFbAmt > 0
  const ttStart = String(ex.tiktok_start || '')
  const ttEnd = String(ex.tiktok_end || '')
  const fbStart = String(ex.fb_start || '')
  const fbEnd = String(ex.fb_end || '')
  const suggestions = String(ex.suggestions || '')
  const note = String(ex.note || '')
  const doneTasks = entry.tasks.filter(t => t.length > 0)
  const dt = new Date(entry.date + 'T00:00:00')
  const d = dt.getDate()
  const mo = dt.getMonth()
  const yr = dt.getFullYear() + 543

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-[#1E3A5F]">วันที่ {d} {THAI_MONTHS[mo]} {yr}</span>
          {entry.time && <span className="text-xs text-gray-400 ml-2">ส่งเมื่อ {entry.time}</span>}
        </div>
        {entry.channels.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end max-w-[160px]">
            {entry.channels.map((ch) => (
              <span key={ch} className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded-full">{ch}</span>
            ))}
          </div>
        )}
      </div>

      {/* Live hours */}
      {hasLiveHours && (
        <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-800 space-y-1">
          {ttMin !== null && <div>📱 TikTok: <strong>{fmtHours(ttMin)}</strong> ({ttStart} – {ttEnd})</div>}
          {fbMin !== null && <div>📘 Facebook: <strong>{fmtHours(fbMin)}</strong> ({fbStart} – {fbEnd})</div>}
          {legacyLiveHours.length > 0 && !ttMin && !fbMin && <div>⏱️ ชั่วโมงไลฟ์: <strong>{legacyLiveHours} ชม.</strong></div>}
          {(ttMin !== null || fbMin !== null) && (
            <div className="pt-1 border-t border-blue-200 font-semibold">รวม: {fmtHours(totalLive)}</div>
          )}
        </div>
      )}

      {/* Sales */}
      {totalSales > 0 && (
        <div className="bg-green-50 rounded-xl px-3 py-2 text-xs text-green-800 space-y-1">
          {shopeeAmt > 0 && <div>Shopee: {shopeeAmt.toLocaleString('th-TH')} บาท</div>}
          {tiktokAmt > 0 && <div>TikTok: {tiktokAmt.toLocaleString('th-TH')} บาท</div>}
          {outsideTtAmt > 0 && <div>โยนนอก TikTok: {outsideTtAmt.toLocaleString('th-TH')} บาท</div>}
          {outsideFbAmt > 0 && <div>โยนนอก Facebook: {outsideFbAmt.toLocaleString('th-TH')} บาท</div>}
          {legacyAmt > 0 && !hasNewFormat && <div>ยอดขาย: {legacyAmt.toLocaleString('th-TH')} บาท</div>}
          <div className="pt-1 border-t border-green-200 font-semibold">รวม: {totalSales.toLocaleString('th-TH')} บาท</div>
        </div>
      )}

      {/* Tasks (non-live departments) */}
      {doneTasks.length > 0 && (
        <div className="space-y-1">
          {doneTasks.map((t, i) => (
            <div key={i} className="flex gap-2 text-xs text-[#374151]">
              <span className="text-gray-400 shrink-0">{i + 1}.</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {entry.obstacles && (
        <div className="text-xs text-gray-500 border-l-2 border-yellow-300 pl-2">
          <span className="font-semibold text-gray-700">ปัญหา:</span> {entry.obstacles}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="text-xs text-gray-500 border-l-2 border-blue-300 pl-2">
          <span className="font-semibold text-gray-700">แนวทาง:</span> {suggestions}
        </div>
      )}
      {note.length > 0 && (
        <div className="text-xs text-gray-400 italic">{note}</div>
      )}
    </div>
  )
}

export default function KpiHistoryPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [nickname, setNickname] = useState('')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NICKNAME_KEY) || localStorage.getItem(DEPT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed === 'string') setNickname(parsed)
      }
    } catch { /* */ }
  }, [])

  const load = useCallback(async (nick: string, mo: string) => {
    if (!nick.trim()) return
    setLoading(true)
    setError('')
    setEntries(null)
    try {
      const res = await fetch(`/api/kpi/mine?nickname=${encodeURIComponent(nick.trim())}&month=${mo}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setEntries(data.entries)
    } catch { setError('ไม่สามารถโหลดข้อมูลได้') } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (nickname.trim()) load(nickname, month) }, [month, load])

  function prevMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const totalSalesMonth = entries?.reduce((s, e) => s + getTotalSales(e.extra), 0) ?? 0

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-['Sarabun']">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-white/70 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-base font-bold">ประวัติ KPI ของฉัน</h1>
          <p className="text-xs text-white/60">ดูย้อนหลังรายเดือน</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">ชื่อเล่น</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load(nickname, month)}
                placeholder="กรอกชื่อเล่นของคุณ"
                className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
              <button
                onClick={() => load(nickname, month)}
                className="bg-[#1E3A5F] text-white px-4 rounded-xl text-sm font-semibold"
              >
                ค้นหา
              </button>
            </div>
          </div>
          {/* Month picker */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#374151] hover:bg-gray-50">‹</button>
            <span className="text-sm font-bold text-[#1E3A5F]">{buddhistMonthYear(month)}</span>
            <button onClick={nextMonth} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#374151] hover:bg-gray-50">›</button>
          </div>
        </div>

        {/* Summary */}
        {entries !== null && entries.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
              <p className="text-2xl font-bold text-[#1E3A5F]">{entries.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">วันที่ส่ง KPI</p>
            </div>
            {totalSalesMonth > 0 && (
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                <p className="text-lg font-bold text-[#16A34A]">{totalSalesMonth.toLocaleString('th-TH')}</p>
                <p className="text-xs text-gray-500 mt-0.5">ยอดขายรวม (บาท)</p>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">{error}</div>
        )}
        {entries !== null && entries.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400 text-sm">ไม่พบข้อมูล KPI ของ &ldquo;{nickname}&rdquo; ในเดือนนี้</div>
        )}
        {entries?.map((e) => <EntryCard key={e.id} entry={e} />)}
      </div>
    </div>
  )
}
